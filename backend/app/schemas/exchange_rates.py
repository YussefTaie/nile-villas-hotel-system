"""Request and response schemas for historical exchange rates."""

from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class ExchangeRateCreate(BaseModel):
    currency: Literal["EUR", "EGP"]
    rate_to_usd: Decimal = Field(gt=0, max_digits=18, decimal_places=6)
    source: Literal["MANUAL", "CENTRAL_BANK"] = "MANUAL"
    effective_from: datetime


class ExchangeRateRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    currency: Literal["EUR", "EGP"]
    rate_to_usd: Decimal
    source: Literal["MANUAL", "CENTRAL_BANK"]
    is_current: bool
    effective_from: datetime
    effective_to: datetime | None
    created_at: datetime


class ExchangeRatePage(BaseModel):
    items: list[ExchangeRateRead]
    total: int
    offset: int
    limit: int
