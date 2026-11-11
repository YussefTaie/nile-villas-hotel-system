"""Shared model helpers backed by the application's declarative base."""

from datetime import datetime

from sqlalchemy import FetchedValue, func
from sqlalchemy.dialects.postgresql import TIMESTAMP
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class TimestampMixin:
    """Created and trigger-maintained update timestamps."""

    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, server_default=func.clock_timestamp()
    )
    updated_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True),
        nullable=False,
        server_default=func.clock_timestamp(),
        server_onupdate=FetchedValue(),
    )


__all__ = ["Base", "TimestampMixin"]
