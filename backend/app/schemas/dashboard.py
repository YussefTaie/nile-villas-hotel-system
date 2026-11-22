"""Response schemas for date-bounded financial dashboard summaries."""

from datetime import date
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel


Currency = Literal["USD", "EUR", "EGP"]


class ReportingPeriod(BaseModel):
    start_date: date
    end_date: date
    timezone: str


class InvoiceSalesSummary(BaseModel):
    completed_invoice_count: int
    total_sales_usd: Decimal


class CurrencyFinancialSummary(BaseModel):
    currency: Currency
    record_count: int
    original_amount: Decimal
    amount_usd_equivalent: Decimal


class TransactionSummary(BaseModel):
    record_count: int
    total_amount_usd_equivalent: Decimal
    by_currency: list[CurrencyFinancialSummary]


class DashboardSummary(BaseModel):
    period: ReportingPeriod
    invoice_sales: InvoiceSalesSummary
    payment_collections: TransactionSummary
    tips: TransactionSummary
