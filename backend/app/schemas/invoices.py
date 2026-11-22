"""Request and response schemas for invoices and their items."""

from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

InvoiceStatus = Literal["OPEN", "PAID", "CANCELLED"]


class InvoiceRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    invoice_number: str
    status: InvoiceStatus
    total_amount_usd: Decimal
    created_at: datetime
    updated_at: datetime
    completed_at: datetime | None
    cancelled_at: datetime | None


class InvoiceItemRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    invoice_id: int
    product_id: int | None
    product_name_snapshot: str
    category_name_snapshot: str
    unit_price_usd: Decimal
    quantity: int
    line_total_usd: Decimal
    created_at: datetime


class InvoiceDetail(InvoiceRead):
    items: list[InvoiceItemRead]


class InvoicePage(BaseModel):
    items: list[InvoiceRead]
    total: int
    offset: int
    limit: int


class InvoiceItemCreate(BaseModel):
    product_id: int = Field(gt=0, le=2_147_483_647)
    quantity: int = Field(default=1, ge=1, le=2_147_483_647)


class InvoiceItemQuantityUpdate(BaseModel):
    quantity: int = Field(ge=1, le=2_147_483_647)


class PaymentCreate(BaseModel):
    currency: Literal["USD", "EUR", "EGP"]
    amount_applied: Decimal = Field(gt=0, max_digits=12, decimal_places=2)
    exchange_rate: Decimal = Field(gt=0, max_digits=18, decimal_places=6)
    amount_usd_equivalent: Decimal = Field(gt=0, max_digits=12, decimal_places=2)
    rate_source: Literal["MANUAL", "CENTRAL_BANK", "BASE"]
    payment_method: Literal["CASH", "VISA"]


class CheckoutRequest(BaseModel):
    payments: list[PaymentCreate] = Field(min_length=1)


class PaymentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    invoice_id: int
    currency: Literal["USD", "EUR", "EGP"]
    amount_applied: Decimal
    exchange_rate: Decimal
    amount_usd_equivalent: Decimal
    rate_source: Literal["MANUAL", "CENTRAL_BANK", "BASE"]
    payment_method: Literal["CASH", "VISA"]
    created_at: datetime
