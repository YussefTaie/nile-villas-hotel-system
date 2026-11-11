"""Invoice and invoice-item API endpoints."""

from datetime import datetime
from typing import Annotated, TypeVar
from collections.abc import Awaitable

from fastapi import APIRouter, Depends, HTTPException, Path, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.schemas.invoices import (
    InvoiceDetail,
    InvoiceItemCreate,
    InvoiceItemQuantityUpdate,
    InvoicePage,
    InvoiceRead,
    InvoiceStatus,
)
from app.services.invoices import (
    InvoiceConflict,
    InvoiceItemNotFound,
    InvoiceNotFound,
    InvoiceProductNotFound,
    InvoiceProductUnavailable,
    InvoiceService,
)

router = APIRouter()
T = TypeVar("T")
InvoiceId = Annotated[int, Path(ge=1, le=9_223_372_036_854_775_807)]
ItemId = Annotated[int, Path(ge=1, le=9_223_372_036_854_775_807)]


def get_invoice_service(db: AsyncSession = Depends(get_db)) -> InvoiceService:
    return InvoiceService(db)


async def _run(operation: Awaitable[T]) -> T:
    try:
        return await operation
    except (InvoiceNotFound, InvoiceProductNotFound, InvoiceItemNotFound) as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Requested invoice resource not found") from exc
    except (InvoiceConflict, InvoiceProductUnavailable) as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc


@router.post(
    "/invoices",
    response_model=InvoiceRead,
    status_code=status.HTTP_201_CREATED,
    tags=["invoices"],
)
async def create_invoice(service: InvoiceService = Depends(get_invoice_service)) -> InvoiceRead:
    return await _run(service.create_invoice())


@router.get("/invoices", response_model=InvoicePage, tags=["invoices"])
async def list_invoices(
    invoice_status: InvoiceStatus | None = Query(default=None, alias="status"),
    created_from: datetime | None = None,
    created_to: datetime | None = None,
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=100),
    service: InvoiceService = Depends(get_invoice_service),
) -> InvoicePage:
    if created_from is not None and created_to is not None and created_from > created_to:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="created_from must be earlier than or equal to created_to",
        )
    return await _run(
        service.list_invoices(
            invoice_status=invoice_status,
            created_from=created_from,
            created_to=created_to,
            offset=offset,
            limit=limit,
        )
    )


@router.get("/invoices/{invoice_id}", response_model=InvoiceDetail, tags=["invoices"])
async def get_invoice(
    invoice_id: InvoiceId,
    service: InvoiceService = Depends(get_invoice_service),
) -> InvoiceDetail:
    return await _run(service.get_invoice(invoice_id))


@router.post(
    "/invoices/{invoice_id}/items",
    response_model=InvoiceDetail,
    status_code=status.HTTP_201_CREATED,
    tags=["invoices"],
)
async def add_invoice_item(
    invoice_id: InvoiceId,
    payload: InvoiceItemCreate,
    service: InvoiceService = Depends(get_invoice_service),
) -> InvoiceDetail:
    return await _run(service.add_item(invoice_id, payload.product_id, payload.quantity))


@router.patch(
    "/invoices/{invoice_id}/items/{item_id}",
    response_model=InvoiceDetail,
    tags=["invoices"],
)
async def update_invoice_item_quantity(
    invoice_id: InvoiceId,
    item_id: ItemId,
    payload: InvoiceItemQuantityUpdate,
    service: InvoiceService = Depends(get_invoice_service),
) -> InvoiceDetail:
    return await _run(service.update_item_quantity(invoice_id, item_id, payload.quantity))


@router.delete(
    "/invoices/{invoice_id}/items/{item_id}",
    response_model=InvoiceDetail,
    tags=["invoices"],
)
async def remove_invoice_item(
    invoice_id: InvoiceId,
    item_id: ItemId,
    service: InvoiceService = Depends(get_invoice_service),
) -> InvoiceDetail:
    return await _run(service.remove_item(invoice_id, item_id))
