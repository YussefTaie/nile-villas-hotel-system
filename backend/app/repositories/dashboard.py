"""Independent aggregate queries for dashboard financial reporting."""

from datetime import datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.invoice import Invoice
from app.models.payment import Payment
from app.models.tip import Tip


class DashboardRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def summarize(
        self, *, interval_start: datetime, interval_end: datetime
    ) -> dict[str, Any]:
        invoice_row = (
            await self.session.execute(
                select(
                    func.count(Invoice.id),
                    func.coalesce(func.sum(Invoice.total_amount_usd), 0),
                ).where(
                    Invoice.status == "PAID",
                    Invoice.completed_at >= interval_start,
                    Invoice.completed_at < interval_end,
                )
            )
        ).one()

        payment_rows = (
            await self.session.execute(
                select(
                    Payment.currency,
                    func.count(Payment.id),
                    func.coalesce(func.sum(Payment.amount_applied), 0),
                    func.coalesce(func.sum(Payment.amount_usd_equivalent), 0),
                )
                .where(
                    Payment.created_at >= interval_start,
                    Payment.created_at < interval_end,
                )
                .group_by(Payment.currency)
                .order_by(Payment.currency)
            )
        ).all()

        tip_rows = (
            await self.session.execute(
                select(
                    Tip.currency,
                    func.count(Tip.id),
                    func.coalesce(func.sum(Tip.amount_received), 0),
                    func.coalesce(func.sum(Tip.amount_usd_equivalent), 0),
                )
                .where(
                    Tip.created_at >= interval_start,
                    Tip.created_at < interval_end,
                )
                .group_by(Tip.currency)
                .order_by(Tip.currency)
            )
        ).all()

        return {
            "invoice_sales": {
                "completed_invoice_count": int(invoice_row[0]),
                "total_sales_usd": Decimal(invoice_row[1] or 0),
            },
            "payment_collections": _transaction_summary(payment_rows),
            "tips": _transaction_summary(tip_rows),
        }


def _transaction_summary(rows: list[Any]) -> dict[str, Any]:
    by_currency = [
        {
            "currency": row[0],
            "record_count": int(row[1]),
            "original_amount": Decimal(row[2] or 0),
            "amount_usd_equivalent": Decimal(row[3] or 0),
        }
        for row in rows
    ]
    return {
        "record_count": sum(row["record_count"] for row in by_currency),
        "total_amount_usd_equivalent": sum(
            (row["amount_usd_equivalent"] for row in by_currency), Decimal("0.00")
        ),
        "by_currency": by_currency,
    }
