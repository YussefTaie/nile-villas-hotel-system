"""Checkout payment settlement tests without depending on a live database."""

from decimal import Decimal
from types import SimpleNamespace
from typing import Any

import pytest
from httpx import AsyncClient

from app.api.v1.invoices import get_invoice_service
from app.main import app
from app.models.payment import Payment
from app.schemas.invoices import PaymentCreate
from app.services.invoices import (
    CheckoutValidationError,
    InvoiceConflict,
    InvoiceService,
)


class Transaction:
    def __init__(self, session: "Session") -> None:
        self.session = session

    async def __aenter__(self) -> None:
        self.snapshot = (self.session.invoice.status, self.session.invoice.completed_at,
                         list(self.session.payments))

    async def __aexit__(self, exc_type: Any, *_args: object) -> None:
        if exc_type is not None:
            (self.session.invoice.status, self.session.invoice.completed_at,
             self.session.payments) = self.snapshot


class Session:
    def __init__(self, invoice: SimpleNamespace) -> None:
        self.invoice = invoice
        self.payments: list[Payment] = []
        self.fail_flush = False

    def begin(self) -> Transaction:
        return Transaction(self)

    def add(self, value: Payment) -> None:
        self.payments.append(value)

    async def flush(self) -> None:
        if self.fail_flush:
            raise RuntimeError("simulated database failure")

    async def refresh(self, _value: object, *, attribute_names: list[str]) -> None:
        assert attribute_names == ["updated_at"]


class Repository:
    def __init__(self, session: Session) -> None:
        self.session = session
        self.invoice = session.invoice
        self.locked = False

    async def get_invoice(self, _invoice_id: int, *, for_update: bool = False):
        self.locked = for_update
        return self.invoice

    async def get_invoice_detail(self, _invoice_id: int):
        return SimpleNamespace(items=[object()])

    async def add_payment(self, payment: Payment) -> None:
        self.session.add(payment)


def payment(currency: str, amount: str, rate: str, equivalent: str,
            source: str = "MANUAL", method: str = "CASH") -> PaymentCreate:
    return PaymentCreate(currency=currency, amount_applied=Decimal(amount),
                         exchange_rate=Decimal(rate), amount_usd_equivalent=Decimal(equivalent),
                         rate_source=source, payment_method=method)


def service(status: str = "OPEN", total: str = "100.00"):
    invoice = SimpleNamespace(id=9, status=status, total_amount_usd=Decimal(total), completed_at=None)
    session = Session(invoice)
    instance = InvoiceService(session)  # type: ignore[arg-type]
    repository = Repository(session)
    instance.repository = repository  # type: ignore[assignment]
    return instance, session, repository


@pytest.mark.asyncio
async def test_checkout_single_currency_marks_invoice_paid() -> None:
    instance, session, repository = service()
    result = await instance.checkout(9, [payment("USD", "100", "1", "100", "BASE")])
    assert result.status == "PAID"
    assert result.completed_at is not None
    assert session.payments[0].amount_usd_equivalent == Decimal("100.00")
    assert repository.locked


@pytest.mark.asyncio
async def test_checkout_split_payment_adjusts_last_equivalent_by_one_cent() -> None:
    instance, session, _ = service(total="100.00")
    result = await instance.checkout(9, [
        payment("USD", "50.00", "1", "50.00", "BASE", "CASH"),
        payment("EUR", "45.00", "0.900000", "50.00", "MANUAL", "VISA"),
    ])
    assert result.status == "PAID"
    assert [item.amount_usd_equivalent for item in session.payments] == [
        Decimal("50.00"), Decimal("50.00")]
    assert session.payments[-1].amount_applied == Decimal("45.00")
    assert sum((item.amount_usd_equivalent for item in session.payments), Decimal("0")) == Decimal("100.00")


@pytest.mark.asyncio
async def test_checkout_rejects_split_underpayment_and_overpayment() -> None:
    for last_amount, last_equivalent in (("44.90", "49.89"), ("54.90", "61.00")):
        instance, session, _ = service()
        with pytest.raises(InvoiceConflict):
            await instance.checkout(9, [
                payment("USD", "50", "1", "50", "BASE"),
                payment("EUR", last_amount, "0.9", last_equivalent),
            ])
        assert not session.payments
        assert session.invoice.status == "OPEN"


@pytest.mark.asyncio
async def test_checkout_rejects_split_rounding_difference_over_one_cent() -> None:
    instance, session, _ = service()
    with pytest.raises(InvoiceConflict):
        await instance.checkout(9, [
            payment("USD", "50", "1", "50", "BASE"),
            payment("EUR", "45.02", "0.9", "50.02"),
        ])
    assert not session.payments


@pytest.mark.asyncio
async def test_checkout_rejects_incorrect_single_payment_equivalent() -> None:
    instance, session, _ = service()
    with pytest.raises(CheckoutValidationError):
        await instance.checkout(9, [payment("USD", "100", "1", "99.99", "BASE")])
    assert not session.payments


@pytest.mark.asyncio
async def test_checkout_empty_invoice_is_rejected() -> None:
    instance, session, _ = service()
    instance.repository.get_invoice_detail = lambda _id: _empty_detail()
    with pytest.raises(InvoiceConflict):
        await instance.checkout(9, [payment("USD", "100", "1", "100", "BASE")])
    assert not session.payments


async def _empty_detail():
    return SimpleNamespace(items=[])


@pytest.mark.asyncio
async def test_checkout_mismatched_or_overpayment_rejected_without_records() -> None:
    for payments in (
        [payment("USD", "99.99", "1", "99.99", "BASE")],
        [payment("USD", "100", "1", "100", "BASE"),
         payment("USD", "1", "1", "1", "BASE")],
    ):
        instance, session, _ = service()
        with pytest.raises(InvoiceConflict):
            await instance.checkout(9, payments)
        assert not session.payments
        assert session.invoice.status == "OPEN"


@pytest.mark.asyncio
async def test_checkout_invalid_rates_rejected() -> None:
    instance, session, _ = service()
    with pytest.raises(CheckoutValidationError):
        await instance.checkout(9, [payment("USD", "100", "2", "50", "BASE")])
    with pytest.raises(CheckoutValidationError):
        await instance.checkout(9, [payment("EUR", "90", "0.9", "100", "BASE")])
    assert not session.payments


@pytest.mark.asyncio
@pytest.mark.parametrize("closed_status", ["PAID", "CANCELLED"])
async def test_checkout_rejects_closed_invoice(closed_status: str) -> None:
    instance, session, _ = service(status=closed_status)
    with pytest.raises(InvoiceConflict):
        await instance.checkout(9, [payment("USD", "100", "1", "100", "BASE")])
    assert not session.payments


@pytest.mark.asyncio
async def test_checkout_rolls_back_all_payments_on_flush_failure() -> None:
    instance, session, _ = service()
    session.fail_flush = True
    with pytest.raises(RuntimeError):
        await instance.checkout(9, [payment("USD", "100", "1", "100", "BASE")])
    assert session.invoice.status == "OPEN"
    assert session.invoice.completed_at is None
    assert session.payments == []


@pytest.mark.asyncio
async def test_checkout_cannot_be_repeated() -> None:
    instance, session, _ = service()
    payload = [payment("USD", "100", "1", "100", "BASE")]
    await instance.checkout(9, payload)
    with pytest.raises(InvoiceConflict):
        await instance.checkout(9, payload)
    assert len(session.payments) == 1


class CheckoutEndpointService:
    async def checkout(self, invoice_id: int, payments: list[PaymentCreate]):
        assert invoice_id == 9
        assert payments[0].currency == "USD"
        return {
            "id": 9, "invoice_number": "INV-000009", "status": "PAID",
            "total_amount_usd": "100.00", "created_at": "2026-11-11T10:00:00Z",
            "updated_at": "2026-11-11T10:00:00Z", "completed_at": "2026-11-11T10:01:00Z",
            "cancelled_at": None,
        }

    async def list_payments(self, invoice_id: int):
        assert invoice_id == 9
        return [{
            "id": 1, "invoice_id": 9, "currency": "USD", "amount_applied": "100.00",
            "exchange_rate": "1.000000", "amount_usd_equivalent": "100.00",
            "rate_source": "BASE", "payment_method": "VISA",
            "created_at": "2026-11-11T10:01:00Z",
        }]


@pytest.mark.asyncio
async def test_checkout_and_payments_endpoints(client: AsyncClient, monkeypatch: pytest.MonkeyPatch) -> None:
    service_instance = CheckoutEndpointService()
    monkeypatch.setitem(app.dependency_overrides, get_invoice_service, lambda: service_instance)
    payload = {"payments": [{
        "currency": "USD", "amount_applied": "100.00", "exchange_rate": "1",
        "amount_usd_equivalent": "100.00", "rate_source": "BASE", "payment_method": "VISA",
    }]}
    checkout_response = await client.post("/api/v1/invoices/9/checkout", json=payload)
    payments_response = await client.get("/api/v1/invoices/9/payments")
    assert checkout_response.status_code == 200
    assert checkout_response.json()["status"] == "PAID"
    assert payments_response.status_code == 200
    assert payments_response.json()[0]["amount_usd_equivalent"] == "100.00"


@pytest.mark.asyncio
async def test_checkout_endpoint_rejects_invalid_payment_payload(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setitem(app.dependency_overrides, get_invoice_service, lambda: CheckoutEndpointService())
    response = await client.post("/api/v1/invoices/9/checkout", json={"payments": [{
        "currency": "GBP", "amount_applied": "100", "exchange_rate": "1",
        "amount_usd_equivalent": "100", "rate_source": "BASE", "payment_method": "CASH",
    }]})
    assert response.status_code == 422
