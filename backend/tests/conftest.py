"""Shared test fixtures for the Nile Villas Hotel System test suite."""

import asyncio
from collections.abc import AsyncGenerator
import os
import sys

if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.engine import make_url

from app.core.config import settings
from app.db.base import Base
from app.db.session import get_db
from app.main import app


# Database tests require an explicit, distinct disposable database. Never fall
# back to DATABASE_URL: setup_database creates and drops every mapped table.
test_database_url = os.environ.get("TEST_DATABASE_URL")
test_engine = None
TestSessionLocal = None
if test_database_url:
    configured = make_url(settings.DATABASE_URL)
    isolated = make_url(test_database_url)
    if (
        configured.host == isolated.host
        and configured.port == isolated.port
        and configured.database == isolated.database
    ):
        raise RuntimeError("TEST_DATABASE_URL must point to a database distinct from DATABASE_URL")
    if not isolated.database or not isolated.database.lower().endswith(("_test", "_testing")):
        raise RuntimeError("TEST_DATABASE_URL database name must end in _test or _testing")
    test_engine = create_async_engine(test_database_url, echo=False)
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
    """Create and drop tables only in the explicitly configured test database.

    Explicitly request this fixture (or `db_session`) in tests that require
    a real database connection.
    """
    if test_engine is None:
        pytest.skip("Set TEST_DATABASE_URL to a dedicated *_test database for database tests")
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest.fixture
async def db_session(setup_database: None) -> AsyncGenerator[AsyncSession, None]:
    """Provide a test-scoped database session."""
    assert TestSessionLocal is not None
    async with TestSessionLocal() as session:
        yield session


async def _override_get_db() -> AsyncGenerator[AsyncSession, None]:
    """Provide a test-scoped session that rolls back after each test."""
    if TestSessionLocal is None:
        pytest.skip("Set TEST_DATABASE_URL to a dedicated *_test database for database-backed API tests")
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

