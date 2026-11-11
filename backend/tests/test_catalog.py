"""Focused API tests for categories and products."""

from collections.abc import Callable
from typing import Any

import pytest
from httpx import AsyncClient

from app.api.v1.catalog import get_catalog_service
from app.db.session import get_db
from app.main import app
from app.services.catalog import CatalogNotFound


class StubCatalogService:
    def __init__(self, **results: Any) -> None:
        self.results = results
        self.calls: list[tuple[str, tuple[Any, ...]]] = []

    def __getattr__(self, name: str) -> Callable[..., Any]:
        async def call(*args: Any) -> Any:
            self.calls.append((name, args))
            result = self.results.get(name)
            if isinstance(result, Exception):
                raise result
            return result

        return call


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("path", "payload"),
    [
        ("/api/v1/categories", {"name": "   "}),
        ("/api/v1/categories", {"name": "Food", "display_order": None}),
        (
            "/api/v1/products",
            {"category_id": 1, "name": "Coffee", "unit_price_usd": "-0.01"},
        ),
        (
            "/api/v1/products",
            {"category_id": 1, "name": "Coffee", "unit_price_usd": "1.999"},
        ),
    ],
)
async def test_create_rejects_invalid_input(
    client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
    path: str,
    payload: dict[str, Any],
) -> None:
    service = StubCatalogService()

    def override_service() -> StubCatalogService:
        return service

    monkeypatch.setitem(app.dependency_overrides, get_catalog_service, override_service)
    response = await client.post(path, json=payload)

    assert response.status_code == 422
    assert service.calls == []


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("path", "method"),
    [
        ("/api/v1/categories/42", "get_category"),
        ("/api/v1/products/42", "get_product"),
    ],
)
async def test_get_returns_not_found(
    client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
    path: str,
    method: str,
) -> None:
    service = StubCatalogService(**{method: CatalogNotFound("Resource")})

    def override_service() -> StubCatalogService:
        return service

    monkeypatch.setitem(app.dependency_overrides, get_catalog_service, override_service)
    response = await client.get(path)

    assert response.status_code == 404
    assert response.json() == {"detail": "Resource not found"}


@pytest.mark.asyncio
async def test_create_product_rejects_missing_category(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    class MissingCategorySession:
        async def get(self, _model: type, _category_id: int) -> None:
            return None

    async def override_db():
        yield MissingCategorySession()

    monkeypatch.setitem(app.dependency_overrides, get_db, override_db)
    response = await client.post(
        "/api/v1/products",
        json={"category_id": 404, "name": "Coffee", "unit_price_usd": "2.50"},
    )

    assert response.status_code == 422
    assert response.json() == {"detail": "Category does not exist"}
