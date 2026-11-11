"""Transactional invoice and line-item business operations."""

from datetime import datetime
from decimal import Decimal

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.invoice import Invoice, InvoiceItem
from app.models.product import Product
from app.repositories.invoices import InvoiceRepository
from app.schemas.invoices import InvoiceStatus


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
    ) -> dict[str, object]:
        invoices, total = await self.repository.list_invoices(
            invoice_status=invoice_status,
            created_from=created_from,
            created_to=created_to,
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
