"""Transactional invoice and line-item business operations."""

from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.invoice import Invoice, InvoiceItem
from app.models.product import Product
from app.models.payment import Payment
from app.repositories.invoices import InvoiceRepository
from app.schemas.invoices import InvoiceStatus, PaymentCreate


class InvoiceNotFound(Exception):
    pass


class InvoiceItemNotFound(Exception):
    pass


class InvoiceProductNotFound(Exception):
    pass


class InvoiceConflict(Exception):
    pass


class InvoiceProductUnavailable(Exception):
    pass


class CheckoutValidationError(Exception):
    pass


class InvoiceService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.repository = InvoiceRepository(session)

    async def create_invoice(self) -> Invoice:
        async with self.session.begin():
            invoice = await self.repository.create_invoice()
            await self.session.flush()
            detail = await self.repository.get_invoice_detail(invoice.id)
            assert detail is not None
            return detail

    async def list_invoices(
        self,
        *,
        invoice_status: InvoiceStatus | None,
        created_from: datetime | None,
        created_to: datetime | None,
        offset: int,
        limit: int,
        invoice_number: str | None = None,
    ) -> dict[str, object]:
        normalized_invoice_number = invoice_number.strip() if invoice_number else None
        invoices, total = await self.repository.list_invoices(
            invoice_status=invoice_status,
            created_from=created_from,
            created_to=created_to,
            invoice_number=normalized_invoice_number or None,
            offset=offset,
            limit=limit,
        )
        return {"items": invoices, "total": total, "offset": offset, "limit": limit}

    async def get_invoice(self, invoice_id: int) -> Invoice:
        invoice = await self.repository.get_invoice_detail(invoice_id)
        if invoice is None:
            raise InvoiceNotFound
        return invoice

    async def _lock_open_invoice(self, invoice_id: int) -> Invoice:
        invoice = await self.repository.get_invoice(invoice_id, for_update=True)
        if invoice is None:
            raise InvoiceNotFound
        if invoice.status != "OPEN":
            raise InvoiceConflict("Items can only be changed on OPEN invoices")
        return invoice

    async def _detail_after_update(self, invoice: Invoice) -> Invoice:
        await self.repository.recalculate_total(invoice)
        await self.session.flush()
        detail = await self.repository.get_invoice_detail(invoice.id)
        assert detail is not None
        return detail

    async def add_item(self, invoice_id: int, product_id: int, quantity: int) -> Invoice:
        async with self.session.begin():
            invoice = await self._lock_open_invoice(invoice_id)
            product_info = await self.repository.get_product_for_invoice(product_id)
            if product_info is None:
                raise InvoiceProductNotFound
            product, category_name = product_info
            if not product.is_active or not product.is_available:
                raise InvoiceProductUnavailable("Product is inactive or unavailable")
            line_total = product.unit_price_usd * quantity
            await self.repository.add_item(
                InvoiceItem(
                    invoice_id=invoice.id,
                    product_id=product.id,
                    product_name_snapshot=product.name,
                    category_name_snapshot=category_name,
                    unit_price_usd=product.unit_price_usd,
                    quantity=quantity,
                    line_total_usd=line_total,
                )
            )
            await self.session.flush()
            return await self._detail_after_update(invoice)

    async def update_item_quantity(
        self, invoice_id: int, item_id: int, quantity: int
    ) -> Invoice:
        async with self.session.begin():
            invoice = await self._lock_open_invoice(invoice_id)
            item = await self.repository.get_invoice_item(invoice_id, item_id, for_update=True)
            if item is None:
                raise InvoiceItemNotFound
            item.quantity = quantity
            item.line_total_usd = item.unit_price_usd * quantity
            await self.session.flush()
            return await self._detail_after_update(invoice)

    async def remove_item(self, invoice_id: int, item_id: int) -> Invoice:
        async with self.session.begin():
            invoice = await self._lock_open_invoice(invoice_id)
            item = await self.repository.get_invoice_item(invoice_id, item_id, for_update=True)
            if item is None:
                raise InvoiceItemNotFound
            await self.repository.delete_item(item)
            await self.session.flush()
            return await self._detail_after_update(invoice)

    async def list_payments(self, invoice_id: int) -> list[Payment]:
        if await self.repository.get_invoice(invoice_id) is None:
            raise InvoiceNotFound
        return await self.repository.list_payments(invoice_id)

    async def checkout(self, invoice_id: int, payments: list[PaymentCreate]) -> Invoice:
        async with self.session.begin():
            invoice = await self._lock_open_invoice(invoice_id)
            if invoice.total_amount_usd <= 0:
                raise InvoiceConflict("Invoice total must be greater than zero")
            # Load line items inside the transaction after the invoice row lock.
            detail = await self.repository.get_invoice_detail(invoice.id)
            if detail is None or not detail.items:
                raise InvoiceConflict("Invoice must contain at least one item")
            total = Decimal(invoice.total_amount_usd).quantize(Decimal("0.01"))
            converted: list[Decimal] = []
            for payment in payments:
                if payment.currency == "USD":
                    if payment.exchange_rate != Decimal("1") or payment.rate_source != "BASE":
                        raise CheckoutValidationError("USD payments must use exchange_rate 1 and rate_source BASE")
                elif payment.rate_source not in {"MANUAL", "CENTRAL_BANK"}:
                    raise CheckoutValidationError("Foreign currency payments must use MANUAL or CENTRAL_BANK rates")
                computed = (payment.amount_applied / payment.exchange_rate).quantize(
                    Decimal("0.01"), rounding=ROUND_HALF_UP
                )
                if computed <= 0:
                    raise CheckoutValidationError("Payment USD equivalent rounds to zero")
                converted.append(computed)

            if len(payments) == 1:
                if payments[0].amount_usd_equivalent != converted[0]:
                    raise CheckoutValidationError(
                        "amount_usd_equivalent must match the rounded conversion"
                    )
                if converted[0] != total:
                    raise InvoiceConflict("Payments must equal the invoice total")
            else:
                for payment, computed in zip(payments[:-1], converted[:-1], strict=True):
                    if payment.amount_usd_equivalent != computed:
                        raise CheckoutValidationError(
                            "amount_usd_equivalent must match the rounded conversion for each payment"
                        )
                prior_total = sum(converted[:-1], Decimal("0.00"))
                if prior_total >= total:
                    raise InvoiceConflict("Payments exceed the invoice total")
                remainder = total - prior_total
                if abs(converted[-1] - remainder) > Decimal("0.01"):
                    raise InvoiceConflict(
                        "Split payments must settle the invoice; last payment rounding difference cannot exceed 0.01 USD"
                    )
                if payments[-1].amount_usd_equivalent not in {converted[-1], remainder}:
                    raise CheckoutValidationError(
                        "Last payment USD equivalent must match its rounded conversion or the remaining balance"
                    )
                converted[-1] = remainder

            if any(value <= 0 for value in converted) or sum(converted, Decimal("0.00")) != total:
                raise InvoiceConflict("Payments must equal the invoice total without overpayment")

            for payment, equivalent in zip(payments, converted, strict=True):
                await self.repository.add_payment(Payment(
                    invoice_id=invoice.id,
                    currency=payment.currency,
                    amount_applied=payment.amount_applied,
                    exchange_rate=payment.exchange_rate,
                    amount_usd_equivalent=equivalent,
                    rate_source=payment.rate_source,
                    payment_method=payment.payment_method,
                ))
            invoice.status = "PAID"
            invoice.completed_at = datetime.now(timezone.utc)
            await self.session.flush()
            # The database trigger updates this server-managed field and SQLAlchemy
            # expires it after flush; refresh it before FastAPI serializes the model.
            await self.session.refresh(invoice, attribute_names=["updated_at"])
            return invoice
