"""Product categories."""

from sqlalchemy import Boolean, CheckConstraint, Identity, Integer, String, UniqueConstraint, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class Category(TimestampMixin, Base):
    __tablename__ = "categories"
    __table_args__ = (
        UniqueConstraint("name", name="uq_categories_name"),
        CheckConstraint("length(trim(name)) > 0", name="ck_categories_name_nonempty"),
    )

    id: Mapped[int] = mapped_column(Integer, Identity(always=True), primary_key=True)
    name: Mapped[str] = mapped_column(String(50), nullable=False)
    description: Mapped[str | None] = mapped_column(String(255))
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("TRUE"))
    display_order: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))

    products: Mapped[list["Product"]] = relationship(
        back_populates="category", passive_deletes="all"
    )
