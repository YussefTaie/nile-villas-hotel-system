"""Exchange-rate current value and history endpoints."""

from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Path, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.schemas.exchange_rates import ExchangeRateCreate, ExchangeRatePage, ExchangeRateRead
from app.services.exchange_rates import ExchangeRateConflict, ExchangeRateService

router = APIRouter()
Currency = Annotated[Literal["EUR", "EGP"], Path()]


def get_exchange_rate_service(db: AsyncSession = Depends(get_db)) -> ExchangeRateService:
    return ExchangeRateService(db)


async def _run(operation):
    try:
        return await operation
    except ExchangeRateConflict as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc


@router.get("/exchange-rates/current", response_model=list[ExchangeRateRead], tags=["exchange rates"])
async def get_current_rates(
    service: ExchangeRateService = Depends(get_exchange_rate_service),
) -> list[ExchangeRateRead]:
    return await service.get_current_rates()


@router.get("/exchange-rates", response_model=ExchangeRatePage, tags=["exchange rates"])
async def list_exchange_rates(
    currency: Literal["EUR", "EGP"] | None = None,
    current_only: bool = False,
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=100),
    service: ExchangeRateService = Depends(get_exchange_rate_service),
) -> ExchangeRatePage:
    return await service.list_rates(currency=currency, current_only=current_only, offset=offset, limit=limit)


@router.get("/exchange-rates/{currency}/current", response_model=ExchangeRateRead, tags=["exchange rates"])
async def get_current_rate(
    currency: Currency, service: ExchangeRateService = Depends(get_exchange_rate_service)
) -> ExchangeRateRead:
    rates = await service.get_current_rates()
    rate = next((item for item in rates if item.currency == currency), None)
    if rate is None:
        raise HTTPException(status_code=404, detail="Current exchange rate not found")
    return rate


@router.post(
    "/exchange-rates", response_model=ExchangeRateRead,
    status_code=status.HTTP_201_CREATED, tags=["exchange rates"],
)
async def set_current_rate(
    payload: ExchangeRateCreate,
    service: ExchangeRateService = Depends(get_exchange_rate_service),
) -> ExchangeRateRead:
    return await _run(service.set_current_rate(payload))
