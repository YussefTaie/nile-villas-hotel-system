"""PostgreSQL checkout and stale-rate integration tests."""

from datetime import datetime, timedelta, timezone
from decimal import Decimal

import pytest
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.exchange_rate import ExchangeRate
from app.models.invoice import Invoice, InvoiceItem
from app.models.payment import Payment
from app.schemas.invoices import PaymentCreate
from app.services.invoices import CheckoutValidationError, InvoiceService


@pytest.mark.asyncio
async def test_checkout_rejects_stale_rate_without_writing_payments(
    db_session: AsyncSession,
) -> None:
    invoice = Invoice(
        invoice_number="INV-CHECKOUT-STALE-RATE",
        status="OPEN",
        total_amount_usd=Decimal("10.00"),
    )
    db_session.add(invoice)
    await db_session.flush()
    invoice_id = invoice.id
    db_session.add_all(
        [
            InvoiceItem(
                invoice_id=invoice.id,
                product_id=None,
                product_name_snapshot="Test item",
                category_name_snapshot="Test",
                unit_price_usd=Decimal("10.00"),
                quantity=1,
                line_total_usd=Decimal("10.00"),
            ),
            ExchangeRate(
                currency="EUR",
                rate_to_usd=Decimal("0.800000"),
                source="MANUAL",
                is_current=True,
                effective_from=datetime.now(timezone.utc) - timedelta(days=1),
            ),
        ]
    )
    await db_session.commit()

    service = InvoiceService(db_session)
    stale_payment = PaymentCreate(
        currency="EUR",
        amount_applied=Decimal("9.00"),
        exchange_rate=Decimal("0.900000"),
        amount_usd_equivalent=Decimal("10.00"),
        rate_source="MANUAL",
        payment_method="CASH",
    )
    with pytest.raises(CheckoutValidationError, match="rate changed"):
        await service.checkout(invoice_id, [stale_payment])

    status = await db_session.scalar(select(Invoice.status).where(Invoice.id == invoice_id))
    payment_count = await db_session.scalar(
        select(func.count(Payment.id)).where(Payment.invoice_id == invoice_id)
    )
    assert status == "OPEN"
    assert payment_count == 0
    await db_session.commit()

    accepted = await service.checkout(
        invoice_id,
        [
            PaymentCreate(
                currency="EUR",
                amount_applied=Decimal("8.00"),
                exchange_rate=Decimal("0.800000"),
                amount_usd_equivalent=Decimal("10.00"),
                rate_source="MANUAL",
                payment_method="VISA",
            )
        ],
    )
    assert accepted.status == "PAID"
    saved_payment = await db_session.scalar(
        select(Payment).where(Payment.invoice_id == invoice_id)
    )
    assert saved_payment is not None
    assert saved_payment.exchange_rate == Decimal("0.800000")
    assert saved_payment.amount_usd_equivalent == Decimal("10.00")
