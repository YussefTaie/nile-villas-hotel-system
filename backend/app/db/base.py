"""SQLAlchemy declarative base for all ORM models."""

from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """Base class for every SQLAlchemy model in the application.

    All models should inherit from this class so that their tables are
    registered in ``Base.metadata`` and automatically discovered by
    Alembic for migration auto-generation.
    """

