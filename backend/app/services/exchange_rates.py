"""Business operations for current and historical exchange rates."""

from datetime import datetime, timezone

from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.exchange_rate import ExchangeRate
from app.repositories.exchange_rates import ExchangeRateRepository
from app.schemas.exchange_rates import ExchangeRateCreate


class ExchangeRateConflict(Exception):
    pass


class ExchangeRateService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.repository = ExchangeRateRepository(session)

    async def list_rates(
        self, *, currency: str | None, current_only: bool, offset: int, limit: int,
    ) -> dict[str, object]:
        items, total = await self.repository.list_rates(
            currency=currency, current_only=current_only, offset=offset, limit=limit
        )
        return {"items": items, "total": total, "offset": offset, "limit": limit}

    async def get_current_rates(self) -> list[ExchangeRate]:
        items, _ = await self.repository.list_rates(currency=None, current_only=True, offset=0, limit=2)
        return items

    async def set_current_rate(self, payload: ExchangeRateCreate) -> ExchangeRate:
        effective_from = payload.effective_from
        if effective_from.tzinfo is None or effective_from.utcoffset() is None:
            raise ExchangeRateConflict("effective_from must include a timezone")
        if effective_from > datetime.now(timezone.utc):
            raise ExchangeRateConflict("effective_from cannot be in the future")

        try:
            async with self.session.begin():
                current = await self.repository.get_current(payload.currency, for_update=True)
                if current is not None:
                    if effective_from <= current.effective_from:
                        raise ExchangeRateConflict("effective_from must be later than the current rate")
                    current.is_current = False
                    current.effective_to = effective_from
                    await self.session.flush()
                rate = ExchangeRate(
                    currency=payload.currency,
                    rate_to_usd=payload.rate_to_usd,
                    source=payload.source,
                    is_current=True,
                    effective_from=effective_from,
                    effective_to=None,
                )
                return await self.repository.add_rate(rate)
        except IntegrityError as exc:
            await self.session.rollback()
            raise ExchangeRateConflict("A current rate already exists for this currency") from exc
