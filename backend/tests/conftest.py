"""Shared test fixtures for the Nile Villas Hotel System test suite."""

import asyncio
from collections.abc import AsyncGenerator
import sys

if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings
from app.db.base import Base
from app.db.session import get_db
from app.main import app


# ── Test database engine ─────────────────────────────────────────────────
# Reuses the same DATABASE_URL.  For isolation you can point a separate
# TEST_DATABASE_URL env var at a dedicated test database.
test_engine = create_async_engine(settings.DATABASE_URL, echo=False)
TestSessionLocal = async_sessionmaker(
    bind=test_engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


@pytest.fixture(scope="session")
def anyio_backend() -> str:
    """Select the asyncio backend for pytest-asyncio."""
    return "asyncio"


@pytest.fixture
async def setup_database() -> AsyncGenerator[None, None]:
    """Create all tables before test and drop them afterwards.

    Explicitly request this fixture (or `db_session`) in tests that require
    a real database connection.
    """
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest.fixture
async def db_session(setup_database: None) -> AsyncGenerator[AsyncSession, None]:
    """Provide a test-scoped database session."""
    async with TestSessionLocal() as session:
        yield session


async def _override_get_db() -> AsyncGenerator[AsyncSession, None]:
    """Provide a test-scoped session that rolls back after each test."""
    async with TestSessionLocal() as session:
        yield session


# Swap the production DB dependency for the test one.
app.dependency_overrides[get_db] = _override_get_db


@pytest.fixture
async def client() -> AsyncGenerator[AsyncClient, None]:
    """Async HTTP client wired to the test application."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

