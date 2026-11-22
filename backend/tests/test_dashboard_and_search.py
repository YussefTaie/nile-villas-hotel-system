"""Date-bounded dashboard reporting and invoice-number search tests."""

from datetime import date, datetime, time, timedelta, timezone
from decimal import Decimal
from zoneinfo import ZoneInfo

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.dashboard import get_dashboard_service
from app.api.v1.invoices import get_invoice_service
from app.core.config import settings
from app.main import app
from app.models.invoice import Invoice
from app.models.payment import Payment
from app.models.tip import Tip
from app.repositories.invoices import InvoiceRepository
from app.services.dashboard import DashboardService


def local_instant(day: date, hour: int = 0, minute: int = 0) -> datetime:
    return datetime.combine(day, time(hour, minute), ZoneInfo("Africa/Cairo"))


@pytest.mark.asyncio
async def test_dashboard_uses_reporting_dates_and_keeps_financial_streams_separate(
    db_session: AsyncSession,
) -> None:
    day_one = date(2026, 1, 15)
    day_two = day_one + timedelta(days=1)
    boundary = local_instant(day_two)

    invoices = [
        Invoice(invoice_number="INV-DASH-001", status="PAID", total_amount_usd=Decimal("100.00"),
                completed_at=local_instant(day_one)),
        Invoice(invoice_number="INV-DASH-002", status="PAID", total_amount_usd=Decimal("50.00"),
                completed_at=local_instant(day_one, 12)),
        Invoice(invoice_number="INV-DASH-003", status="PAID", total_amount_usd=Decimal("75.00"),
                completed_at=boundary),
        Invoice(invoice_number="INV-DASH-OPEN", status="OPEN", total_amount_usd=Decimal("20.00")),
        Invoice(invoice_number="INV-DASH-CANCEL", status="CANCELLED", total_amount_usd=Decimal("30.00"),
                cancelled_at=local_instant(day_one, 16)),
    ]
    db_session.add_all(invoices)
    await db_session.flush()

    db_session.add_all([
        Payment(invoice_id=invoices[0].id, currency="USD", amount_applied=Decimal("60.00"),
                exchange_rate=Decimal("1.000000"), amount_usd_equivalent=Decimal("60.00"),
                rate_source="BASE", payment_method="CASH", created_at=local_instant(day_one)),
        Payment(invoice_id=invoices[0].id, currency="EUR", amount_applied=Decimal("32.00"),
                exchange_rate=Decimal("0.800000"), amount_usd_equivalent=Decimal("40.00"),
                rate_source="MANUAL", payment_method="VISA", created_at=local_instant(day_one, 12)),
        Payment(invoice_id=invoices[2].id, currency="EGP", amount_applied=Decimal("2500.00"),
                exchange_rate=Decimal("50.000000"), amount_usd_equivalent=Decimal("50.00"),
                rate_source="MANUAL", payment_method="CASH", created_at=boundary),
        Tip(invoice_id=invoices[0].id, currency="EGP", amount_received=Decimal("100.00"),
            exchange_rate=Decimal("50.000000"), amount_usd_equivalent=Decimal("2.00"),
            rate_source="MANUAL", payment_method="CASH", created_at=local_instant(day_one, 23, 59)),
        Tip(invoice_id=None, currency="EGP", amount_received=Decimal("200.00"),
            exchange_rate=Decimal("50.000000"), amount_usd_equivalent=Decimal("4.00"),
            rate_source="MANUAL", payment_method="VISA", created_at=local_instant(day_one, 14)),
        Tip(invoice_id=None, currency="USD", amount_received=Decimal("3.00"),
            exchange_rate=Decimal("1.000000"), amount_usd_equivalent=Decimal("3.00"),
            rate_source="BASE", payment_method="CASH", created_at=boundary),
    ])
    await db_session.flush()

    service = DashboardService(db_session, "Africa/Cairo")
    first_day = await service.summarize(start_date=day_one, end_date=day_one)
    assert first_day["period"]["timezone"] == "Africa/Cairo"  # type: ignore[index]
    assert first_day["invoice_sales"] == {
        "completed_invoice_count": 2,
        "total_sales_usd": Decimal("150.00"),
    }
    assert first_day["payment_collections"] == {
        "record_count": 2,
        "total_amount_usd_equivalent": Decimal("100.00"),
        "by_currency": [
            {"currency": "EUR", "record_count": 1, "original_amount": Decimal("32.00"),
             "amount_usd_equivalent": Decimal("40.00")},
            {"currency": "USD", "record_count": 1, "original_amount": Decimal("60.00"),
             "amount_usd_equivalent": Decimal("60.00")},
        ],
    }
    assert first_day["tips"] == {
        "record_count": 2,
        "total_amount_usd_equivalent": Decimal("6.00"),
        "by_currency": [
            {"currency": "EGP", "record_count": 2, "original_amount": Decimal("300.00"),
             "amount_usd_equivalent": Decimal("6.00")},
        ],
    }

    second_day = await service.summarize(start_date=day_two, end_date=day_two)
    assert second_day["invoice_sales"]["total_sales_usd"] == Decimal("75.00")  # type: ignore[index]
    assert second_day["payment_collections"]["record_count"] == 1  # type: ignore[index]
    assert second_day["tips"]["total_amount_usd_equivalent"] == Decimal("3.00")  # type: ignore[index]

    empty_day = await service.summarize(start_date=day_two + timedelta(days=1), end_date=day_two + timedelta(days=1))
    assert empty_day["invoice_sales"]["completed_invoice_count"] == 0  # type: ignore[index]
    assert empty_day["payment_collections"] == {
        "record_count": 0, "total_amount_usd_equivalent": Decimal("0.00"), "by_currency": []
    }
    assert empty_day["tips"] == {
        "record_count": 0, "total_amount_usd_equivalent": Decimal("0.00"), "by_currency": []
    }

    start_utc = local_instant(day_one).astimezone(timezone.utc)
    end_utc = boundary.astimezone(timezone.utc)
    assert start_utc == datetime(2026, 1, 14, 22, tzinfo=timezone.utc)
    assert end_utc == datetime(2026, 1, 15, 22, tzinfo=timezone.utc)


@pytest.mark.asyncio
async def test_invoice_number_search_is_case_insensitive_combined_and_paginated(
    db_session: AsyncSession,
) -> None:
    db_session.add_all([
        Invoice(invoice_number="INV-2026-ALPHA", status="OPEN", total_amount_usd=Decimal("0.00")),
        Invoice(invoice_number="inv-2026-alpine", status="PAID", total_amount_usd=Decimal("10.00"),
                completed_at=datetime(2026, 1, 15, tzinfo=timezone.utc)),
        Invoice(invoice_number="INV-2025-BETA", status="OPEN", total_amount_usd=Decimal("0.00")),
    ])
    await db_session.flush()
    repository = InvoiceRepository(db_session)

    matches, total = await repository.list_invoices(
        invoice_status=None, created_from=None, created_to=None, invoice_number="2026-al", offset=0, limit=10,
    )
    assert total == 2
    assert {item.invoice_number for item in matches} == {"INV-2026-ALPHA", "inv-2026-alpine"}

    exact, exact_total = await repository.list_invoices(
        invoice_status=None, created_from=None, created_to=None,
        invoice_number="INV-2026-ALPHA", offset=0, limit=10,
    )
    assert exact_total == 1
    assert exact[0].invoice_number == "INV-2026-ALPHA"

    filtered, filtered_total = await repository.list_invoices(
        invoice_status="OPEN", created_from=None, created_to=None, invoice_number="2026", offset=0, limit=1,
    )
    assert filtered_total == 1
    assert len(filtered) == 1
    assert filtered[0].invoice_number == "INV-2026-ALPHA"

    first_page, search_total = await repository.list_invoices(
        invoice_status=None, created_from=None, created_to=None, invoice_number="2026", offset=0, limit=1,
    )
    second_page, second_total = await repository.list_invoices(
        invoice_status=None, created_from=None, created_to=None, invoice_number="2026", offset=1, limit=1,
    )
    assert search_total == second_total == 2
    assert len(first_page) == len(second_page) == 1

    omitted, omitted_total = await repository.list_invoices(
        invoice_status=None, created_from=None, created_to=None, offset=0, limit=10,
    )
    assert omitted_total == 3
    assert len(omitted) == 3


@pytest.mark.asyncio
async def test_dashboard_api_requires_valid_explicit_date_interval(
    client: AsyncClient,
) -> None:
    missing = await client.get("/api/v1/dashboard/summary")
    reversed_interval = await client.get(
        "/api/v1/dashboard/summary?start_date=2026-01-16&end_date=2026-01-15"
    )
    malformed = await client.get(
        "/api/v1/dashboard/summary?start_date=2026-02-30&end_date=2026-03-01"
    )
    assert missing.status_code == reversed_interval.status_code == malformed.status_code == 422


@pytest.mark.asyncio
async def test_dashboard_api_serializes_financial_summary(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch,
) -> None:
    class DashboardStub:
        async def summarize(self, *, start_date: date, end_date: date):
            return {
                "period": {"start_date": start_date, "end_date": end_date, "timezone": settings.REPORTING_TIMEZONE},
                "invoice_sales": {"completed_invoice_count": 1, "total_sales_usd": Decimal("25.50")},
                "payment_collections": {"record_count": 1, "total_amount_usd_equivalent": Decimal("25.50"),
                                        "by_currency": [{"currency": "USD", "record_count": 1,
                                                         "original_amount": Decimal("25.50"),
                                                         "amount_usd_equivalent": Decimal("25.50")}]},
                "tips": {"record_count": 0, "total_amount_usd_equivalent": Decimal("0.00"), "by_currency": []},
            }

    monkeypatch.setitem(app.dependency_overrides, get_dashboard_service, lambda: DashboardStub())
    response = await client.get(
        "/api/v1/dashboard/summary?start_date=2026-01-15&end_date=2026-01-15"
    )
    assert response.status_code == 200
    assert response.json()["invoice_sales"]["total_sales_usd"] == "25.50"
    assert response.json()["payment_collections"]["by_currency"][0]["currency"] == "USD"
    assert response.json()["tips"]["record_count"] == 0


@pytest.mark.asyncio
async def test_invoice_search_parameter_reaches_existing_service(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch,
) -> None:
    class InvoiceListStub:
        seen: dict[str, object] = {}

        async def list_invoices(self, **kwargs):
            self.seen = kwargs
            return {"items": [], "total": 0, "offset": kwargs["offset"], "limit": kwargs["limit"]}

    stub = InvoiceListStub()
    monkeypatch.setitem(app.dependency_overrides, get_invoice_service, lambda: stub)
    response = await client.get(
        "/api/v1/invoices?invoice_number=2026-al&status=OPEN&created_from=2026-01-01T00:00:00Z&offset=5&limit=10"
    )
    assert response.status_code == 200
    assert stub.seen["invoice_number"] == "2026-al"
    assert stub.seen["invoice_status"] == "OPEN"
    assert stub.seen["offset"] == 5
    assert stub.seen["limit"] == 10
