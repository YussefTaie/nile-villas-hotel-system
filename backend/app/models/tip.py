"""Independent tip transactions."""

from decimal import Decimal
from datetime import datetime

from sqlalchemy import BigInteger, CheckConstraint, ForeignKey, Identity, Index, Numeric, String, func, text
from sqlalchemy.dialects.postgresql import TIMESTAMP
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class Tip(Base):
    __tablename__ = "tips"
    __table_args__ = (
        CheckConstraint("currency IN ('USD', 'EUR', 'EGP')", name="ck_tips_currency"),
        CheckConstraint("amount_received > 0", name="ck_tips_amount_positive"),
        CheckConstraint("exchange_rate > 0", name="ck_tips_exchange_rate_positive"),
        CheckConstraint("amount_usd_equivalent > 0", name="ck_tips_usd_equivalent_positive"),
        CheckConstraint("rate_source IN ('MANUAL', 'CENTRAL_BANK', 'BASE')", name="ck_tips_rate_source"),
        CheckConstraint("payment_method IN ('CASH', 'VISA')", name="ck_tips_method"),
        CheckConstraint(
            "(currency = 'USD' AND exchange_rate = 1.000000 AND rate_source = 'BASE') OR "
            "(currency <> 'USD' AND rate_source IN ('MANUAL', 'CENTRAL_BANK'))",
            name="ck_tips_currency_rate_source",
        ),
        Index("ix_tips_invoice_id", "invoice_id", postgresql_where=text("invoice_id IS NOT NULL")),
    )

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    invoice_id: Mapped[int | None] = mapped_column(ForeignKey("invoices.id", ondelete="RESTRICT"))
    currency: Mapped[str] = mapped_column(String(3), nullable=False)
    amount_received: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    exchange_rate: Mapped[Decimal] = mapped_column(Numeric(18, 6), nullable=False)
    amount_usd_equivalent: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    rate_source: Mapped[str] = mapped_column(String(20), nullable=False)
    payment_method: Mapped[str] = mapped_column(String(10), nullable=False)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), nullable=False, server_default=func.clock_timestamp())

    invoice: Mapped["Invoice | None"] = relationship(back_populates="tips")


Index("ix_tips_created_at", Tip.created_at.desc())
