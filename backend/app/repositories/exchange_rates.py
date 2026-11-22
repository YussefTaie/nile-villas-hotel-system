"""Persistence operations for exchange-rate history."""

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.exchange_rate import ExchangeRate


class ExchangeRateRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_current(self, currency: str, *, for_update: bool = False) -> ExchangeRate | None:
        statement = select(ExchangeRate).where(
            ExchangeRate.currency == currency, ExchangeRate.is_current.is_(True)
        )
        if for_update:
            statement = statement.with_for_update(of=ExchangeRate)
        return await self.session.scalar(statement)

    async def list_rates(
        self, *, currency: str | None, current_only: bool, offset: int, limit: int,
    ) -> tuple[list[ExchangeRate], int]:
        filters = []
        if currency is not None:
            filters.append(ExchangeRate.currency == currency)
        if current_only:
            filters.append(ExchangeRate.is_current.is_(True))
        total = await self.session.scalar(select(func.count(ExchangeRate.id)).where(*filters))
        result = await self.session.scalars(
            select(ExchangeRate).where(*filters)
            .order_by(ExchangeRate.currency, ExchangeRate.effective_from.desc(), ExchangeRate.id.desc())
            .offset(offset).limit(limit)
        )
        return list(result.all()), int(total or 0)

    async def add_rate(self, rate: ExchangeRate) -> ExchangeRate:
        self.session.add(rate)
        await self.session.flush()
        await self.session.refresh(rate)
        return rate
