"""Tests for Tips and Exchange Rates APIs and financial rules."""

from datetime import datetime, timedelta, timezone
from decimal import Decimal
from types import SimpleNamespace
from typing import Any

import pytest
from httpx import AsyncClient

from app.api.v1.exchange_rates import get_exchange_rate_service
from app.api.v1.tips import get_tip_service
from app.main import app
from app.models.exchange_rate import ExchangeRate
from app.models.tip import Tip
from app.schemas.exchange_rates import ExchangeRateCreate
from app.schemas.tips import TipCreate
from app.services.exchange_rates import ExchangeRateConflict, ExchangeRateService
from app.services.tips import TipInvoiceNotFound, TipInvoiceNotPaid, TipService, TipValidationError


class FakeTransaction:
    async def __aenter__(self) -> None:
        return None

    async def __aexit__(self, *_args: object) -> None:
        return None


class FakeSession:
    def begin(self) -> FakeTransaction:
        return FakeTransaction()

    async def flush(self) -> None:
        return None


class TipRepo:
    def __init__(self, status: str | None = "PAID") -> None:
        self.invoice = None if status is None else SimpleNamespace(
            id=12, status=status, total_amount_usd=Decimal("88.00"), payments=["existing"]
        )
        self.tips: list[Tip] = []
        self.lock_requests: list[bool] = []

    async def get_invoice(self, _id: int, *, for_update: bool = False):
        self.lock_requests.append(for_update)
        return self.invoice

    async def add_tip(self, tip: Tip) -> Tip:
        tip.id = len(self.tips) + 1
        tip.created_at = datetime.now(timezone.utc)
        self.tips.append(tip)
        return tip

    async def list_tips(self, **_kwargs: Any):
        return self.tips, len(self.tips)

    async def list_invoice_tips(self, _invoice_id: int):
        return [tip for tip in self.tips if tip.invoice_id == _invoice_id]


def tip_payload(**overrides: Any) -> TipCreate:
    values: dict[str, Any] = {
        "invoice_id": 12, "currency": "EUR", "amount_received": "90.00",
        "exchange_rate": "0.900000", "amount_usd_equivalent": "100.00",
        "rate_source": "MANUAL", "payment_method": "CASH",
    }
    values.update(overrides)
    return TipCreate(**values)


@pytest.mark.asyncio
async def test_linked_and_standalone_tips_are_independent_and_can_repeat() -> None:
    session = FakeSession()
    service = TipService(session)  # type: ignore[arg-type]
    repository = TipRepo()
    service.repository = repository  # type: ignore[assignment]
    invoice_before = (repository.invoice.status, repository.invoice.total_amount_usd,
                      list(repository.invoice.payments))
    await service.create_tip(tip_payload())
    await service.create_tip(tip_payload(payment_method="VISA"))
    await service.create_tip(tip_payload(invoice_id=None, currency="USD", amount_received="5.00",
                                          exchange_rate="1", amount_usd_equivalent="5.00", rate_source="BASE"))
    assert len(repository.tips) == 3
    assert len(await service.list_invoice_tips(12)) == 2
    assert (repository.invoice.status, repository.invoice.total_amount_usd,
            repository.invoice.payments) == invoice_before
    assert repository.lock_requests[:2] == [True, True]


@pytest.mark.asyncio
@pytest.mark.parametrize("status", ["OPEN", "CANCELLED"])
async def test_linked_tip_rejected_for_non_paid_invoice(status: str) -> None:
    service = TipService(FakeSession())  # type: ignore[arg-type]
    service.repository = TipRepo(status)  # type: ignore[assignment]
    with pytest.raises(TipInvoiceNotPaid):
        await service.create_tip(tip_payload())


@pytest.mark.asyncio
async def test_tip_validation_and_missing_invoice() -> None:
    service = TipService(FakeSession())  # type: ignore[arg-type]
    service.repository = TipRepo(None)  # type: ignore[assignment]
    with pytest.raises(TipInvoiceNotFound):
        await service.create_tip(tip_payload())
    service.repository = TipRepo()  # type: ignore[assignment]
    with pytest.raises(TipValidationError):
        await service.create_tip(tip_payload(amount_usd_equivalent="99.99"))
    with pytest.raises(TipValidationError):
        await service.create_tip(tip_payload(currency="USD", exchange_rate="2", rate_source="BASE"))
    with pytest.raises(TipValidationError):
        await service.create_tip(tip_payload(rate_source="BASE"))


@pytest.mark.asyncio
async def test_tip_conversion_uses_decimal_round_half_up() -> None:
    service = TipService(FakeSession())  # type: ignore[arg-type]
    repository = TipRepo()
    service.repository = repository  # type: ignore[assignment]
    await service.create_tip(tip_payload(amount_received="1.00", exchange_rate="0.600000",
                                          amount_usd_equivalent="1.67"))
    assert repository.tips[0].amount_usd_equivalent == Decimal("1.67")
    with pytest.raises(TipValidationError):
        await service.create_tip(tip_payload(amount_received="1.00", exchange_rate="0.600000",
                                              amount_usd_equivalent="1.66"))


class RateRepo:
    def __init__(self, current: ExchangeRate | None = None) -> None:
        self.current = current
        self.rows = [current] if current is not None else []

    async def get_current(self, _currency: str, *, for_update: bool = False):
        self.locked = for_update
        return self.current

    async def add_rate(self, rate: ExchangeRate):
        self.current = rate
        self.rows.append(rate)
        rate.id = len(self.rows)
        rate.created_at = datetime.now(timezone.utc)
        return rate

    async def list_rates(self, *, currency, current_only, offset, limit):
        rows = [r for r in self.rows if (currency is None or r.currency == currency)
                and (not current_only or r.is_current)]
        return rows[offset:offset + limit], len(rows)


def make_rate_service(current: ExchangeRate | None = None):
    service = ExchangeRateService(FakeSession())  # type: ignore[arg-type]
    repo = RateRepo(current)
    service.repository = repo  # type: ignore[assignment]
    return service, repo


@pytest.mark.asyncio
async def test_exchange_rate_update_preserves_history_and_single_current() -> None:
    start = datetime.now(timezone.utc) - timedelta(days=2)
    previous = ExchangeRate(currency="EUR", rate_to_usd=Decimal("0.900000"), source="MANUAL",
                            is_current=True, effective_from=start, effective_to=None)
    service, repo = make_rate_service(previous)
    new_start = datetime.now(timezone.utc) - timedelta(seconds=1)
    current = await service.set_current_rate(ExchangeRateCreate(
        currency="EUR", rate_to_usd=Decimal("0.950000"), source="CENTRAL_BANK", effective_from=new_start
    ))
    assert current.is_current and current.rate_to_usd == Decimal("0.950000")
    assert len(repo.rows) == 2
    assert previous.is_current is False and previous.effective_to == new_start
    assert sum(rate.is_current for rate in repo.rows) == 1
    assert repo.locked


@pytest.mark.asyncio
async def test_exchange_rate_rejects_naive_and_non_increasing_effective_dates() -> None:
    service, _repo = make_rate_service()
    with pytest.raises(ExchangeRateConflict):
        await service.set_current_rate(ExchangeRateCreate(
            currency="EGP", rate_to_usd=Decimal("50"), effective_from=datetime.now()
        ))
    start = datetime.now(timezone.utc) - timedelta(days=1)
    old = ExchangeRate(currency="EGP", rate_to_usd=Decimal("50"), source="MANUAL", is_current=True,
                       effective_from=start, effective_to=None)
    service, _repo = make_rate_service(old)
    with pytest.raises(ExchangeRateConflict):
        await service.set_current_rate(ExchangeRateCreate(
            currency="EGP", rate_to_usd=Decimal("51"), effective_from=start
        ))


class TipApiService:
    async def create_tip(self, payload: TipCreate):
        if payload.invoice_id == 99:
            raise TipInvoiceNotFound
        if payload.invoice_id == 10:
            raise TipInvoiceNotPaid
        if payload.currency == "USD" and payload.rate_source != "BASE":
            raise TipValidationError("USD tips require BASE")
        return {"id": 1, "invoice_id": payload.invoice_id, "currency": payload.currency,
                "amount_received": payload.amount_received, "exchange_rate": payload.exchange_rate,
                "amount_usd_equivalent": payload.amount_usd_equivalent, "rate_source": payload.rate_source,
                "payment_method": payload.payment_method, "created_at": "2026-11-15T10:00:00Z"}

    async def list_tips(self, **kwargs: Any):
        return {"items": [], "total": 0, "offset": kwargs["offset"], "limit": kwargs["limit"]}

    async def list_invoice_tips(self, _id: int):
        return []


class RateApiService:
    async def get_current_rates(self):
        return []

    async def list_rates(self, **kwargs: Any):
        return {"items": [], "total": 0, "offset": kwargs["offset"], "limit": kwargs["limit"]}

    async def set_current_rate(self, payload: ExchangeRateCreate):
        if payload.effective_from > datetime.now(timezone.utc):
            raise ExchangeRateConflict("effective_from cannot be in the future")
        return {"id": 1, "currency": payload.currency, "rate_to_usd": payload.rate_to_usd,
                "source": payload.source, "is_current": True, "effective_from": payload.effective_from,
                "effective_to": None, "created_at": "2026-11-15T10:00:00Z"}


@pytest.mark.asyncio
async def test_tips_and_exchange_rate_api_endpoints(client: AsyncClient, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setitem(app.dependency_overrides, get_tip_service, lambda: TipApiService())
    monkeypatch.setitem(app.dependency_overrides, get_exchange_rate_service, lambda: RateApiService())
    tip = await client.post("/api/v1/tips", json={
        "invoice_id": None, "currency": "USD", "amount_received": "5.00", "exchange_rate": "1",
        "amount_usd_equivalent": "5.00", "rate_source": "BASE", "payment_method": "VISA",
    })
    tips = await client.get("/api/v1/tips?currency=USD&limit=10")
    invoice_tips = await client.get("/api/v1/invoices/12/tips")
    current = await client.get("/api/v1/exchange-rates/current")
    history = await client.get("/api/v1/exchange-rates?currency=EUR")
    rate = await client.post("/api/v1/exchange-rates", json={
        "currency": "EUR", "rate_to_usd": "0.900000", "source": "MANUAL",
        "effective_from": (datetime.now(timezone.utc) - timedelta(seconds=1)).isoformat(),
    })
    assert tip.status_code == 201 and tip.json()["invoice_id"] is None
    assert tips.status_code == invoice_tips.status_code == current.status_code == history.status_code == 200
    assert rate.status_code == 201


@pytest.mark.asyncio
async def test_tips_api_error_mapping_and_payload_validation(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setitem(app.dependency_overrides, get_tip_service, lambda: TipApiService())
    payload = {"invoice_id": 99, "currency": "USD", "amount_received": "10", "exchange_rate": "1",
               "amount_usd_equivalent": "10", "rate_source": "BASE", "payment_method": "CASH"}
    missing = await client.post("/api/v1/tips", json=payload)
    payload["invoice_id"] = 10
    closed = await client.post("/api/v1/tips", json=payload)
    payload["currency"] = "GBP"
    invalid = await client.post("/api/v1/tips", json=payload)
    assert missing.status_code == 404
    assert closed.status_code == 409
    assert invalid.status_code == 422
