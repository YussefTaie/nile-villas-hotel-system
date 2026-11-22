"""Persistence operations for tips."""

from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.invoice import Invoice
from app.models.tip import Tip


class TipRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_invoice(self, invoice_id: int, *, for_update: bool = False) -> Invoice | None:
        statement = select(Invoice).where(Invoice.id == invoice_id)
        if for_update:
            statement = statement.with_for_update(of=Invoice)
        return await self.session.scalar(statement)

    async def add_tip(self, tip: Tip) -> Tip:
        self.session.add(tip)
        await self.session.flush()
        await self.session.refresh(tip)
        return tip

    async def list_tips(
        self, *, invoice_id: int | None, currency: str | None, payment_method: str | None,
        created_from: datetime | None, created_to: datetime | None, offset: int, limit: int,
    ) -> tuple[list[Tip], int]:
        filters = []
        if invoice_id is not None:
            filters.append(Tip.invoice_id == invoice_id)
        if currency is not None:
            filters.append(Tip.currency == currency)
        if payment_method is not None:
            filters.append(Tip.payment_method == payment_method)
        if created_from is not None:
            filters.append(Tip.created_at >= created_from)
        if created_to is not None:
            filters.append(Tip.created_at <= created_to)
        total = await self.session.scalar(select(func.count(Tip.id)).where(*filters))
        result = await self.session.scalars(
            select(Tip).where(*filters).order_by(Tip.created_at.desc(), Tip.id.desc())
            .offset(offset).limit(limit)
        )
        return list(result.all()), int(total or 0)

    async def list_invoice_tips(self, invoice_id: int) -> list[Tip]:
        result = await self.session.scalars(
            select(Tip).where(Tip.invoice_id == invoice_id).order_by(Tip.created_at.desc(), Tip.id.desc())
        )
        return list(result.all())
