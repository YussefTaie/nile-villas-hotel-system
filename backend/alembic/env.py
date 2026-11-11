"""Alembic migration environment for Nile Villas Hotel System.

This module is executed by Alembic whenever migrations are run.  It reads
the database URL from the application settings (not from alembic.ini) so
that the connection string is defined in exactly one place.
"""

from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool

from app.core.config import settings

# Import Base so that its metadata reflects every model.  As models are
# added to app/models/, they must be imported (directly or transitively)
# before Alembic inspects metadata.  The canonical way is to import them
# in app/models/__init__.py so this single import picks them all up.
from app.db.base import Base  # noqa: F401
import app.models  # noqa: F401

# ── Alembic Config object ───────────────────────────────────────────────
config = context.config

# Interpret the config file for Python logging (if present).
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Override the placeholder URL from alembic.ini with the real one.
config.set_main_option("sqlalchemy.url", settings.DATABASE_URL)

# This is the MetaData object that Alembic compares against the database
# when auto-generating migrations.
target_metadata = Base.metadata


# ── Offline mode (generates SQL script without connecting) ───────────────
def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


# ── Online mode (connects to the database) ───────────────────────────────
def run_migrations_online() -> None:
    """Run migrations in 'online' mode."""
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()

