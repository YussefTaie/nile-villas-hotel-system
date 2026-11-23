from collections.abc import AsyncGenerator

import pytest
from httpx import AsyncClient
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.main import app


class FakeSession:
    """Minimal async session double for health endpoint tests."""

    def __init__(self, error: SQLAlchemyError | None = None) -> None:
        self.error = error
        self.execute_calls = 0

    async def execute(self, _statement: object) -> None:
        self.execute_calls += 1
        if self.error is not None:
            raise self.error


@pytest.mark.asyncio
async def test_health_check_database_available(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Return healthy when PostgreSQL accepts a simple query."""
    session = FakeSession()

    async def override_get_db() -> AsyncGenerator[AsyncSession, None]:
        yield session

    monkeypatch.setitem(app.dependency_overrides, get_db, override_get_db)

    response = await client.get("/api/v1/health")
    assert response.status_code == 200
    assert response.json() == {"status": "healthy"}
    assert session.execute_calls == 1


@pytest.mark.asyncio
async def test_health_check_database_unavailable(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Return a generic unhealthy response when PostgreSQL is unavailable."""
    session = FakeSession(SQLAlchemyError("private connection details"))

    async def override_get_db() -> AsyncGenerator[AsyncSession, None]:
        yield session

    monkeypatch.setitem(app.dependency_overrides, get_db, override_get_db)

    response = await client.get("/api/v1/health")
    assert response.status_code == 503
    assert response.json() == {"status": "unhealthy"}
    assert "private connection details" not in response.text
    assert session.execute_calls == 1


@pytest.mark.asyncio
async def test_cors_allows_only_configured_local_frontend_origins(client: AsyncClient) -> None:
    for origin in ("http://localhost:5173", "http://127.0.0.1:5173"):
        response = await client.options(
            "/api/v1/health",
            headers={
                "Origin": origin,
                "Access-Control-Request-Method": "GET",
                "Access-Control-Request-Headers": "content-type",
            },
        )
        assert response.status_code == 200
        assert response.headers["access-control-allow-origin"] == origin

    denied = await client.options(
        "/api/v1/health",
        headers={
            "Origin": "https://untrusted.example",
            "Access-Control-Request-Method": "GET",
        },
    )
    assert "access-control-allow-origin" not in denied.headers

