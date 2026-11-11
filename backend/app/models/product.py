"""POS products."""

from decimal import Decimal

from sqlalchemy import Boolean, CheckConstraint, ForeignKey, Identity, Index, Integer, Numeric, String, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class Product(TimestampMixin, Base):
    __tablename__ = "products"
    __table_args__ = (
        CheckConstraint("length(trim(name)) > 0", name="ck_products_name_nonempty"),
        CheckConstraint("unit_price_usd >= 0", name="ck_products_unit_price_nonnegative"),
        Index("ix_products_category_active_available", "category_id", "is_active", "is_available"),
    )

    id: Mapped[int] = mapped_column(Integer, Identity(always=True), primary_key=True)
    category_id: Mapped[int] = mapped_column(
        ForeignKey("categories.id", ondelete="RESTRICT"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str | None] = mapped_column(String(255))
    unit_price_usd: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    is_available: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("TRUE"))
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("TRUE"))

    category: Mapped["Category"] = relationship(back_populates="products")
    invoice_items: Mapped[list["InvoiceItem"]] = relationship(
        back_populates="product", passive_deletes="all"
    )
