"""Request and response schemas for independent tip transactions."""

from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class TipCreate(BaseModel):
    invoice_id: int | None = Field(default=None, gt=0, le=9_223_372_036_854_775_807)
    currency: Literal["USD", "EUR", "EGP"]
    amount_received: Decimal = Field(gt=0, max_digits=12, decimal_places=2)
    exchange_rate: Decimal = Field(gt=0, max_digits=18, decimal_places=6)
    amount_usd_equivalent: Decimal = Field(gt=0, max_digits=12, decimal_places=2)
    rate_source: Literal["MANUAL", "CENTRAL_BANK", "BASE"]
    payment_method: Literal["CASH", "VISA"]


class TipRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    invoice_id: int | None
    currency: Literal["USD", "EUR", "EGP"]
    amount_received: Decimal
    exchange_rate: Decimal
    amount_usd_equivalent: Decimal
    rate_source: Literal["MANUAL", "CENTRAL_BANK", "BASE"]
    payment_method: Literal["CASH", "VISA"]
    created_at: datetime


class TipPage(BaseModel):
    items: list[TipRead]
    total: int
    offset: int
    limit: int
