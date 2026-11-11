"""Invoices and immutable line item snapshots."""

from decimal import Decimal
from datetime import datetime

from sqlalchemy import (
    BigInteger, CheckConstraint, ForeignKey, Identity, Index, Integer, Numeric, String,
    UniqueConstraint, func, text,
)
from sqlalchemy.dialects.postgresql import TIMESTAMP
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class Invoice(TimestampMixin, Base):
    __tablename__ = "invoices"
    __table_args__ = (
        UniqueConstraint("invoice_number", name="uq_invoices_invoice_number"),
        CheckConstraint("status IN ('OPEN', 'PAID', 'CANCELLED')", name="ck_invoices_status"),
        CheckConstraint("total_amount_usd >= 0", name="ck_invoices_total_nonnegative"),
        CheckConstraint(
            "(status = 'PAID' AND completed_at IS NOT NULL AND total_amount_usd > 0) OR "
            "(status <> 'PAID' AND completed_at IS NULL)", name="ck_invoices_paid_consistency",
        ),
        CheckConstraint(
            "(status = 'CANCELLED' AND cancelled_at IS NOT NULL) OR "
            "(status <> 'CANCELLED' AND cancelled_at IS NULL)", name="ck_invoices_cancelled_consistency",
        ),
    )

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    invoice_number: Mapped[str] = mapped_column(
        String(32), nullable=False, server_default=text("generate_invoice_number()")
    )
    status: Mapped[str] = mapped_column(String(20), nullable=False, server_default=text("'OPEN'"))
    total_amount_usd: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, server_default=text("0.00"))
    completed_at: Mapped[datetime | None] = mapped_column(TIMESTAMP(timezone=True))
    cancelled_at: Mapped[datetime | None] = mapped_column(TIMESTAMP(timezone=True))

    items: Mapped[list["InvoiceItem"]] = relationship(back_populates="invoice", passive_deletes="all")
    payments: Mapped[list["Payment"]] = relationship(back_populates="invoice", passive_deletes="all")
    tips: Mapped[list["Tip"]] = relationship(back_populates="invoice", passive_deletes="all")


Index("ix_invoices_status_created_at", Invoice.status, Invoice.created_at.desc())
Index(
    "ix_invoices_paid_completed_at", Invoice.completed_at.desc(),
    postgresql_where=Invoice.status == "PAID",
)


class InvoiceItem(Base):
    __tablename__ = "invoice_items"
    __table_args__ = (
        CheckConstraint("unit_price_usd >= 0", name="ck_invoice_items_unit_price_nonnegative"),
        CheckConstraint("quantity > 0", name="ck_invoice_items_quantity_positive"),
        CheckConstraint("line_total_usd = quantity * unit_price_usd", name="ck_invoice_items_line_total"),
        Index("ix_invoice_items_invoice_id", "invoice_id"),
        Index("ix_invoice_items_product_id", "product_id"),
        Index("ix_invoice_items_product_name_snapshot", "product_name_snapshot"),
    )

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    invoice_id: Mapped[int] = mapped_column(ForeignKey("invoices.id", ondelete="RESTRICT"), nullable=False)
    product_id: Mapped[int | None] = mapped_column(ForeignKey("products.id", ondelete="SET NULL"))
    product_name_snapshot: Mapped[str] = mapped_column(String(100), nullable=False)
    category_name_snapshot: Mapped[str] = mapped_column(String(50), nullable=False)
    unit_price_usd: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("1"))
    line_total_usd: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), nullable=False, server_default=func.clock_timestamp())

    invoice: Mapped[Invoice] = relationship(back_populates="items")
    product: Mapped["Product | None"] = relationship(back_populates="invoice_items")
