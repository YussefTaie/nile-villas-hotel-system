"""Cross-feature acceptance flow against the isolated PostgreSQL test database."""

from datetime import datetime, timezone
from zoneinfo import ZoneInfo

import pytest
from httpx import AsyncClient


def payment(
    currency: str,
    amount: str,
    rate: str,
    equivalent: str,
    source: str,
    method: str,
) -> dict[str, str]:
    return {
        "currency": currency,
        "amount_applied": amount,
        "exchange_rate": rate,
        "amount_usd_equivalent": equivalent,
        "rate_source": source,
        "payment_method": method,
    }


@pytest.mark.asyncio
async def test_catalog_checkout_tips_history_and_dashboard_acceptance(
    client: AsyncClient,
    setup_database: None,
) -> None:
    category_response = await client.post(
        "/api/v1/categories", json={"name": "Acceptance Dining"}
    )
    assert category_response.status_code == 201
    category_id = category_response.json()["id"]

    first_product = await client.post(
        "/api/v1/products",
        json={"category_id": category_id, "name": "Acceptance entrée", "unit_price_usd": "8.00"},
    )
    second_product = await client.post(
        "/api/v1/products",
        json={"category_id": category_id, "name": "Acceptance drink", "unit_price_usd": "5.00"},
    )
    assert first_product.status_code == second_product.status_code == 201
    first_product_id = first_product.json()["id"]
    second_product_id = second_product.json()["id"]
    catalog = await client.get("/api/v1/products")
    assert {item["id"] for item in catalog.json()} == {first_product_id, second_product_id}

    disabled = await client.patch(
        f"/api/v1/products/{first_product_id}/availability", json={"is_available": False}
    )
    assert disabled.status_code == 200 and disabled.json()["is_available"] is False
    unavailable_invoice = (await client.post("/api/v1/invoices")).json()
    unavailable_add = await client.post(
        f"/api/v1/invoices/{unavailable_invoice['id']}/items",
        json={"product_id": first_product_id, "quantity": 1},
    )
    assert unavailable_add.status_code == 409
    enabled = await client.patch(
        f"/api/v1/products/{first_product_id}/availability", json={"is_available": True}
    )
    assert enabled.status_code == 200 and enabled.json()["is_available"] is True

    usd_invoice = (await client.post("/api/v1/invoices")).json()
    invoice_id = usd_invoice["id"]
    first_line = await client.post(
        f"/api/v1/invoices/{invoice_id}/items",
        json={"product_id": first_product_id, "quantity": 1},
    )
    second_line = await client.post(
        f"/api/v1/invoices/{invoice_id}/items",
        json={"product_id": second_product_id, "quantity": 1},
    )
    assert first_line.status_code == second_line.status_code == 201
    first_item_id = first_line.json()["items"][0]["id"]
    changed_quantity = await client.patch(
        f"/api/v1/invoices/{invoice_id}/items/{first_item_id}", json={"quantity": 2}
    )
    assert changed_quantity.status_code == 200
    assert changed_quantity.json()["total_amount_usd"] == "21.00"

    usd_checkout = await client.post(
        f"/api/v1/invoices/{invoice_id}/checkout",
        json={"payments": [payment("USD", "21.00", "1.000000", "21.00", "BASE", "VISA")]},
    )
    assert usd_checkout.status_code == 200 and usd_checkout.json()["status"] == "PAID"
    usd_payments = (await client.get(f"/api/v1/invoices/{invoice_id}/payments")).json()
    assert len(usd_payments) == 1
    assert usd_payments[0]["currency"] == "USD"
    assert usd_payments[0]["rate_source"] == "BASE"
    assert usd_payments[0]["exchange_rate"] == "1.000000"
    usd_detail = (await client.get(f"/api/v1/invoices/{invoice_id}")).json()
    assert usd_detail["status"] == "PAID"
    assert usd_detail["items"][0]["product_name_snapshot"] == "Acceptance entrée"

    effective = datetime.now(timezone.utc).isoformat()
    for currency, rate in (("EUR", "0.800000"), ("EGP", "50.000000")):
        created = await client.post(
            "/api/v1/exchange-rates",
            json={"currency": currency, "rate_to_usd": rate, "source": "MANUAL", "effective_from": effective},
        )
        assert created.status_code == 201
    current_rates = await client.get("/api/v1/exchange-rates/current")
    assert {item["currency"] for item in current_rates.json()} == {"EUR", "EGP"}

    foreign_invoice = (await client.post("/api/v1/invoices")).json()
    foreign_invoice_id = foreign_invoice["id"]
    for product_id in (first_product_id, second_product_id):
        added = await client.post(
            f"/api/v1/invoices/{foreign_invoice_id}/items",
            json={"product_id": product_id, "quantity": 1},
        )
        assert added.status_code == 201
    assert added.json()["total_amount_usd"] == "13.00"

    insufficient = await client.post(
        f"/api/v1/invoices/{foreign_invoice_id}/checkout",
        json={"payments": [
            payment("USD", "5.00", "1.000000", "5.00", "BASE", "CASH"),
            payment("EUR", "4.00", "0.800000", "5.00", "MANUAL", "VISA"),
        ]},
    )
    assert insufficient.status_code == 409
    assert (await client.get(f"/api/v1/invoices/{foreign_invoice_id}")).json()["status"] == "OPEN"
    assert (await client.get(f"/api/v1/invoices/{foreign_invoice_id}/payments")).json() == []

    foreign_checkout = await client.post(
        f"/api/v1/invoices/{foreign_invoice_id}/checkout",
        json={"payments": [
            payment("USD", "5.00", "1.000000", "5.00", "BASE", "CASH"),
            payment("EUR", "4.00", "0.800000", "5.00", "MANUAL", "VISA"),
            payment("EGP", "149.74", "50.000000", "2.99", "MANUAL", "CASH"),
        ]},
    )
    assert foreign_checkout.status_code == 200
    foreign_payments = (await client.get(f"/api/v1/invoices/{foreign_invoice_id}/payments")).json()
    assert [(row["currency"], row["amount_applied"], row["payment_method"]) for row in foreign_payments] == [
        ("USD", "5.00", "CASH"), ("EUR", "4.00", "VISA"), ("EGP", "149.74", "CASH")
    ]
    assert [row["exchange_rate"] for row in foreign_payments] == ["1.000000", "0.800000", "50.000000"]
    assert [row["amount_usd_equivalent"] for row in foreign_payments] == ["5.00", "5.00", "3.00"]
    duplicate = await client.post(
        f"/api/v1/invoices/{foreign_invoice_id}/checkout",
        json={"payments": [payment("USD", "13.00", "1.000000", "13.00", "BASE", "CASH")]},
    )
    assert duplicate.status_code == 409
    assert len((await client.get(f"/api/v1/invoices/{foreign_invoice_id}/payments")).json()) == 3

    open_invoice = (await client.post("/api/v1/invoices")).json()
    linked_to_open = await client.post(
        "/api/v1/tips",
        json={"invoice_id": open_invoice["id"], "currency": "USD", "amount_received": "1.00",
              "exchange_rate": "1.000000", "amount_usd_equivalent": "1.00", "rate_source": "BASE",
              "payment_method": "CASH"},
    )
    assert linked_to_open.status_code == 409

    standalone_tip = await client.post(
        "/api/v1/tips",
        json={"invoice_id": None, "currency": "USD", "amount_received": "5.00",
              "exchange_rate": "1.000000", "amount_usd_equivalent": "5.00", "rate_source": "BASE",
              "payment_method": "CASH"},
    )
    linked_eur_tip = await client.post(
        "/api/v1/tips",
        json={"invoice_id": invoice_id, "currency": "EUR", "amount_received": "1.60",
              "exchange_rate": "0.800000", "amount_usd_equivalent": "2.00", "rate_source": "MANUAL",
              "payment_method": "CASH"},
    )
    linked_egp_tip = await client.post(
        "/api/v1/tips",
        json={"invoice_id": invoice_id, "currency": "EGP", "amount_received": "100.00",
              "exchange_rate": "50.000000", "amount_usd_equivalent": "2.00", "rate_source": "MANUAL",
              "payment_method": "VISA"},
    )
    assert standalone_tip.status_code == linked_eur_tip.status_code == linked_egp_tip.status_code == 201
    invoice_tips = (await client.get(f"/api/v1/invoices/{invoice_id}/tips")).json()
    assert len(invoice_tips) == 2
    assert (await client.get(f"/api/v1/invoices/{invoice_id}/payments")).json() == usd_payments
    assert (await client.get(f"/api/v1/invoices/{invoice_id}")).json()["total_amount_usd"] == "21.00"

    eur_history = await client.get("/api/v1/exchange-rates?currency=EUR&limit=10")
    next_rate = await client.post(
        "/api/v1/exchange-rates",
        json={"currency": "EUR", "rate_to_usd": "0.900000", "source": "CENTRAL_BANK",
              "effective_from": datetime.now(timezone.utc).isoformat()},
    )
    assert next_rate.status_code == 201
    updated_history = await client.get("/api/v1/exchange-rates?currency=EUR&limit=10")
    assert updated_history.json()["total"] == eur_history.json()["total"] + 1
    assert updated_history.json()["items"][1]["effective_to"] is not None
    assert (await client.get(f"/api/v1/invoices/{foreign_invoice_id}/payments")).json() == foreign_payments
    assert (await client.get(f"/api/v1/invoices/{invoice_id}/tips")).json() == invoice_tips

    paid_page = await client.get("/api/v1/invoices?status=PAID&offset=0&limit=1")
    paid_page_two = await client.get("/api/v1/invoices?status=PAID&offset=1&limit=1")
    searched = await client.get(f"/api/v1/invoices?invoice_number={usd_invoice['invoice_number']}")
    assert paid_page.json()["total"] == paid_page_two.json()["total"] == 2
    assert paid_page.json()["items"][0]["id"] != paid_page_two.json()["items"][0]["id"]
    assert searched.json()["total"] == 1

    all_tips = await client.get("/api/v1/tips?offset=0&limit=2")
    final_tips_page = await client.get("/api/v1/tips?offset=2&limit=2")
    filtered_tips = await client.get(f"/api/v1/tips?invoice_id={invoice_id}&currency=EUR&payment_method=CASH")
    assert all_tips.json()["total"] == final_tips_page.json()["total"] == 3
    assert len(all_tips.json()["items"]) == 2 and len(final_tips_page.json()["items"]) == 1
    assert filtered_tips.json()["total"] == 1

    reporting_day = datetime.now(ZoneInfo("Africa/Cairo")).date().isoformat()
    dashboard = await client.get(
        f"/api/v1/dashboard/summary?start_date={reporting_day}&end_date={reporting_day}"
    )
    assert dashboard.status_code == 200
    summary = dashboard.json()
    assert summary["invoice_sales"]["completed_invoice_count"] == 2
    assert summary["invoice_sales"]["total_sales_usd"] == "34.00"
    assert summary["payment_collections"]["record_count"] == 4
    assert summary["payment_collections"]["total_amount_usd_equivalent"] == "34.00"
    assert summary["payment_collections"]["by_currency"] == [
        {"currency": "EGP", "record_count": 1, "original_amount": "149.74", "amount_usd_equivalent": "3.00"},
        {"currency": "EUR", "record_count": 1, "original_amount": "4.00", "amount_usd_equivalent": "5.00"},
        {"currency": "USD", "record_count": 2, "original_amount": "26.00", "amount_usd_equivalent": "26.00"},
    ]
    assert summary["tips"]["record_count"] == 3
    assert summary["tips"]["total_amount_usd_equivalent"] == "9.00"
