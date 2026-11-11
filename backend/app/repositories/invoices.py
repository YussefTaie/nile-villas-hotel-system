"""Persistence operations for invoices and invoice items."""

from datetime import datetime
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.category import Category
from app.models.invoice import Invoice, InvoiceItem
from app.models.product import Product
from app.schemas.invoices import InvoiceStatus


class InvoiceRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def list_invoices(
        self,
        *,
        invoice_status: InvoiceStatus | None,
        created_from: datetime | None,
        created_to: datetime | None,
        offset: int,
        limit: int,
    ) -> tuple[list[Invoice], int]:
        filters = []
        if invoice_status is not None:
            filters.append(Invoice.status == invoice_status)
        if created_from is not None:
            filters.append(Invoice.created_at >= created_from)
        if created_to is not None:
            filters.append(Invoice.created_at <= created_to)

        total = await self.session.scalar(select(func.count(Invoice.id)).where(*filters))
        result = await self.session.scalars(
            select(Invoice)
            .where(*filters)
            .order_by(Invoice.created_at.desc(), Invoice.id.desc())
            .offset(offset)
            .limit(limit)
        )
        return list(result.all()), int(total or 0)

    async def get_invoice(self, invoice_id: int, *, for_update: bool = False) -> Invoice | None:
        statement = select(Invoice).where(Invoice.id == invoice_id)
        if for_update:
            statement = statement.with_for_update(of=Invoice)
        return await self.session.scalar(statement)

    async def get_invoice_detail(self, invoice_id: int) -> Invoice | None:
        statement = (
            select(Invoice)
            .where(Invoice.id == invoice_id)
            .options(selectinload(Invoice.items))
        )
        return await self.session.scalar(statement)

    async def get_invoice_item(
        self, invoice_id: int, item_id: int, *, for_update: bool = False
    ) -> InvoiceItem | None:
        statement = select(InvoiceItem).where(
            InvoiceItem.invoice_id == invoice_id,
            InvoiceItem.id == item_id,
        )
        if for_update:
            statement = statement.with_for_update(of=InvoiceItem)
        return await self.session.scalar(statement)

    async def get_product_for_invoice(self, product_id: int) -> tuple[Product, str] | None:
        result = await self.session.execute(
            select(Product, Category.name)
            .join(Category, Category.id == Product.category_id)
            .where(Product.id == product_id)
            .with_for_update(of=Product)
        )
        row = result.first()
        if row is None:
            return None
        product, category_name = row
        return product, category_name

    async def create_invoice(self) -> Invoice:
        invoice = Invoice()
        self.session.add(invoice)
        await self.session.flush()
        return invoice

    async def add_item(self, item: InvoiceItem) -> None:
        self.session.add(item)

    async def delete_item(self, item: InvoiceItem) -> None:
        await self.session.delete(item)

    async def recalculate_total(self, invoice: Invoice) -> Decimal:
        total = await self.session.scalar(
            select(func.coalesce(func.sum(InvoiceItem.line_total_usd), 0)).where(
                InvoiceItem.invoice_id == invoice.id
            )
        )
        invoice.total_amount_usd = Decimal(total or 0)
        return invoice.total_amount_usd
