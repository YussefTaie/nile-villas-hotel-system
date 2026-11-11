"""API and service tests for OPEN invoice editing."""

from collections.abc import Callable
from decimal import Decimal
from types import SimpleNamespace
from typing import Any

import pytest
from httpx import AsyncClient
from sqlalchemy.dialects import postgresql

from app.api.v1.invoices import get_invoice_service
from app.main import app
from app.models.invoice import InvoiceItem
from app.repositories.invoices import InvoiceRepository
from app.services.invoices import (
    InvoiceConflict,
    InvoiceNotFound,
    InvoiceProductUnavailable,
    InvoiceService,
)


class StubInvoiceService:
    def __init__(self, **results: Any) -> None:
        self.results = results
        self.calls: list[tuple[str, tuple[Any, ...]]] = []

    def __getattr__(self, name: str) -> Callable[..., Any]:
        async def call(*args: Any, **kwargs: Any) -> Any:
            self.calls.append((name, args))
            result = self.results.get(name)
            if isinstance(result, Exception):
                raise result
            return result

        return call


class FakeTransaction:
    async def __aenter__(self) -> None:
        return None

    async def __aexit__(self, *_args: object) -> None:
        return None


class FakeSession:
    def __init__(self) -> None:
        self.added: list[object] = []
        self.flush_count = 0

    def begin(self) -> FakeTransaction:
        return FakeTransaction()

    def add(self, value: object) -> None:
        self.added.append(value)

    async def flush(self) -> None:
        self.flush_count += 1

    async def delete(self, value: object) -> None:
        return None


class FakeInvoiceRepository:
    def __init__(self, invoice: SimpleNamespace, product: SimpleNamespace) -> None:
        self.invoice = invoice
        self.product = product
        self.items: list[InvoiceItem] = []
        self.next_item_id = 1
        self.calls: list[tuple[str, bool]] = []

    async def get_invoice(self, _invoice_id: int, *, for_update: bool = False) -> SimpleNamespace:
        self.calls.append(("get_invoice", for_update))
        return self.invoice

    async def get_product_for_invoice(self, _product_id: int) -> tuple[SimpleNamespace, str]:
        return self.product, "Beverages"

    async def add_item(self, item: InvoiceItem) -> None:
        item.id = self.next_item_id
        self.next_item_id += 1
        self.items.append(item)

    async def get_invoice_item(
        self, _invoice_id: int, item_id: int, *, for_update: bool = False
    ) -> InvoiceItem | None:
        self.calls.append(("get_invoice_item", for_update))
        return next((item for item in self.items if item.id == item_id), None)

    async def delete_item(self, item: InvoiceItem) -> None:
        self.items.remove(item)

    async def recalculate_total(self, invoice: SimpleNamespace) -> Decimal:
        invoice.total_amount_usd = sum(
            (item.line_total_usd for item in self.items), Decimal("0.00")
        )
        return invoice.total_amount_usd

    async def get_invoice_detail(self, _invoice_id: int) -> SimpleNamespace:
        self.invoice.items = list(self.items)
        return self.invoice


def make_service(status: str = "OPEN", *, active: bool = True, available: bool = True):
    session = FakeSession()
    invoice = SimpleNamespace(id=7, status=status, total_amount_usd=Decimal("0.00"), items=[])
    product = SimpleNamespace(
        id=3,
        name="Coffee",
        unit_price_usd=Decimal("2.50"),
        is_active=active,
        is_available=available,
    )
    service = InvoiceService(session)  # type: ignore[arg-type]
    repository = FakeInvoiceRepository(invoice, product)
    service.repository = repository  # type: ignore[assignment]
    return service, session, repository, invoice


@pytest.mark.asyncio
async def test_item_changes_snapshot_and_recalculate_total() -> None:
    service, session, repository, invoice = make_service()

    detail = await service.add_item(invoice.id, product_id=3, quantity=2)
    assert invoice.total_amount_usd == Decimal("5.00")
    assert detail.items[0].product_name_snapshot == "Coffee"
    assert detail.items[0].category_name_snapshot == "Beverages"
    assert detail.items[0].unit_price_usd == Decimal("2.50")

    await service.update_item_quantity(invoice.id, item_id=1, quantity=3)
    assert invoice.total_amount_usd == Decimal("7.50")

    await service.remove_item(invoice.id, item_id=1)
    assert invoice.total_amount_usd == Decimal("0.00")
    assert repository.items == []
    assert session.flush_count == 6
    assert repository.calls.count(("get_invoice", True)) == 3
    assert repository.calls.count(("get_invoice_item", True)) == 2


@pytest.mark.asyncio
@pytest.mark.parametrize("status", ["PAID", "CANCELLED"])
@pytest.mark.parametrize("operation", ["add", "update", "remove"])
async def test_closed_invoices_reject_item_changes(status: str, operation: str) -> None:
    service, _session, _repository, invoice = make_service(status)
    with pytest.raises(InvoiceConflict):
        if operation == "add":
            await service.add_item(invoice.id, product_id=3, quantity=1)
        elif operation == "update":
            await service.update_item_quantity(invoice.id, item_id=1, quantity=2)
        else:
            await service.remove_item(invoice.id, item_id=1)


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("active", "available"), [(False, True), (True, False), (False, False)]
)
async def test_inactive_or_unavailable_products_are_rejected(
    active: bool, available: bool
) -> None:
    service, _session, _repository, invoice = make_service(
        active=active, available=available
    )
    with pytest.raises(InvoiceProductUnavailable):
        await service.add_item(invoice.id, product_id=3, quantity=1)


@pytest.mark.asyncio
async def test_invoice_and_item_locks_compile_for_postgresql() -> None:
    class StatementCapture:
        statement: Any = None

        async def scalar(self, statement: Any) -> None:
            self.statement = statement
            return None

    capture = StatementCapture()
    repository = InvoiceRepository(capture)  # type: ignore[arg-type]
    await repository.get_invoice(7, for_update=True)
    compiled = str(capture.statement.compile(dialect=postgresql.dialect()))
    assert "FOR UPDATE OF invoices" in compiled

    await repository.get_invoice_item(7, 11, for_update=True)
    compiled = str(capture.statement.compile(dialect=postgresql.dialect()))
    assert "FOR UPDATE OF invoice_items" in compiled


@pytest.mark.asyncio
async def test_create_and_list_invoice_api(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    invoice = {
        "id": 7,
        "invoice_number": "INV-000007",
        "status": "OPEN",
        "total_amount_usd": "0.00",
        "created_at": "2026-11-11T10:00:00Z",
        "updated_at": "2026-11-11T10:00:00Z",
        "completed_at": None,
        "cancelled_at": None,
    }
    service = StubInvoiceService(create_invoice=invoice, list_invoices={"items": [invoice], "total": 1, "offset": 0, "limit": 5})

    def override_service() -> StubInvoiceService:
        return service

    monkeypatch.setitem(app.dependency_overrides, get_invoice_service, override_service)
    created = await client.post("/api/v1/invoices")
    listed = await client.get("/api/v1/invoices?status=OPEN&limit=5")

    assert created.status_code == 201
    assert created.json()["status"] == "OPEN"
    assert listed.status_code == 200
    assert listed.json()["total"] == 1
    assert service.calls[1][0] == "list_invoices"


@pytest.mark.asyncio
async def test_invoice_validation_and_not_found(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    service = StubInvoiceService(get_invoice=InvoiceNotFound())

    def override_service() -> StubInvoiceService:
        return service

    monkeypatch.setitem(app.dependency_overrides, get_invoice_service, override_service)
    invalid_quantity = await client.post(
        "/api/v1/invoices/7/items", json={"product_id": 3, "quantity": 0}
    )
    invalid_status = await client.get("/api/v1/invoices?status=REFUNDED")
    not_found = await client.get("/api/v1/invoices/999")

    assert invalid_quantity.status_code == 422
    assert invalid_status.status_code == 422
    assert not_found.status_code == 404


@pytest.mark.asyncio
async def test_invoice_api_maps_closed_status_to_conflict(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    service = StubInvoiceService(add_item=InvoiceConflict("Items can only be changed on OPEN invoices"))

    def override_service() -> StubInvoiceService:
        return service

    monkeypatch.setitem(app.dependency_overrides, get_invoice_service, override_service)
    response = await client.post(
        "/api/v1/invoices/7/items", json={"product_id": 3, "quantity": 1}
    )

    assert response.status_code == 409
