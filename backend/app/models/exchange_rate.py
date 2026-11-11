"""Historical exchange rates."""

from decimal import Decimal
from datetime import datetime

from sqlalchemy import Boolean, CheckConstraint, Identity, Index, Integer, Numeric, String, func, text
from sqlalchemy.dialects.postgresql import TIMESTAMP
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class ExchangeRate(Base):
    __tablename__ = "exchange_rates"
    __table_args__ = (
        CheckConstraint("currency IN ('EUR', 'EGP')", name="ck_exchange_rates_currency"),
        CheckConstraint("rate_to_usd > 0", name="ck_exchange_rates_rate_positive"),
        CheckConstraint("source IN ('MANUAL', 'CENTRAL_BANK')", name="ck_exchange_rates_source"),
        CheckConstraint("effective_to IS NULL OR effective_from < effective_to", name="ck_exchange_rates_interval"),
        CheckConstraint(
            "(is_current = TRUE AND effective_to IS NULL) OR "
            "(is_current = FALSE AND effective_to IS NOT NULL)",
            name="ck_exchange_rates_current_consistency",
        ),
        Index(
            "uq_exchange_rates_current_currency", "currency", unique=True,
            postgresql_where=text("is_current = TRUE"),
        ),
    )

    id: Mapped[int] = mapped_column(Integer, Identity(always=True), primary_key=True)
    currency: Mapped[str] = mapped_column(String(3), nullable=False)
    rate_to_usd: Mapped[Decimal] = mapped_column(Numeric(18, 6), nullable=False)
    source: Mapped[str] = mapped_column(String(20), nullable=False, server_default=text("'MANUAL'"))
    is_current: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("TRUE"))
    effective_from: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), nullable=False, server_default=func.clock_timestamp())
    effective_to: Mapped[datetime | None] = mapped_column(TIMESTAMP(timezone=True))
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), nullable=False, server_default=func.clock_timestamp())
