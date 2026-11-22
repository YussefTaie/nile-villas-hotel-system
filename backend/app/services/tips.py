"""Business operations for independent tip transactions."""

from datetime import datetime
from decimal import Decimal, ROUND_HALF_UP

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.tip import Tip
from app.repositories.tips import TipRepository
from app.schemas.tips import TipCreate


class TipInvoiceNotFound(Exception):
    pass


class TipInvoiceNotPaid(Exception):
    pass


class TipValidationError(Exception):
    pass


class TipService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.repository = TipRepository(session)

    async def create_tip(self, payload: TipCreate) -> Tip:
        if payload.currency == "USD":
            if payload.exchange_rate != Decimal("1") or payload.rate_source != "BASE":
                raise TipValidationError("USD tips must use exchange_rate 1 and rate_source BASE")
        elif payload.rate_source not in {"MANUAL", "CENTRAL_BANK"}:
            raise TipValidationError("Foreign currency tips require MANUAL or CENTRAL_BANK rate source")
        calculated = (payload.amount_received / payload.exchange_rate).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP
        )
        if calculated <= 0 or calculated != payload.amount_usd_equivalent:
            raise TipValidationError("amount_usd_equivalent must equal the rounded currency conversion")

        async with self.session.begin():
            if payload.invoice_id is not None:
                invoice = await self.repository.get_invoice(payload.invoice_id, for_update=True)
                if invoice is None:
                    raise TipInvoiceNotFound
                if invoice.status != "PAID":
                    raise TipInvoiceNotPaid
            tip = Tip(
                invoice_id=payload.invoice_id,
                currency=payload.currency,
                amount_received=payload.amount_received,
                exchange_rate=payload.exchange_rate,
                amount_usd_equivalent=calculated,
                rate_source=payload.rate_source,
                payment_method=payload.payment_method,
            )
            return await self.repository.add_tip(tip)

    async def list_tips(
        self, *, invoice_id: int | None, currency: str | None, payment_method: str | None,
        created_from: datetime | None, created_to: datetime | None, offset: int, limit: int,
    ) -> dict[str, object]:
        if invoice_id is not None and await self.repository.get_invoice(invoice_id) is None:
            raise TipInvoiceNotFound
        items, total = await self.repository.list_tips(
            invoice_id=invoice_id, currency=currency, payment_method=payment_method,
            created_from=created_from, created_to=created_to, offset=offset, limit=limit,
        )
        return {"items": items, "total": total, "offset": offset, "limit": limit}

    async def list_invoice_tips(self, invoice_id: int) -> list[Tip]:
        if await self.repository.get_invoice(invoice_id) is None:
            raise TipInvoiceNotFound
        return await self.repository.list_invoice_tips(invoice_id)
