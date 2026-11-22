"""Tips API endpoints."""

from datetime import datetime
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Path, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.schemas.tips import TipCreate, TipPage, TipRead
from app.services.tips import TipInvoiceNotFound, TipInvoiceNotPaid, TipService, TipValidationError

router = APIRouter()
InvoiceId = Annotated[int, Path(ge=1, le=9_223_372_036_854_775_807)]


def get_tip_service(db: AsyncSession = Depends(get_db)) -> TipService:
    return TipService(db)


async def _run(operation):
    try:
        return await operation
    except TipInvoiceNotFound as exc:
        raise HTTPException(status_code=404, detail="Invoice not found") from exc
    except TipInvoiceNotPaid as exc:
        raise HTTPException(status_code=409, detail="Tips can only be linked to PAID invoices") from exc
    except TipValidationError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.post("/tips", response_model=TipRead, status_code=status.HTTP_201_CREATED, tags=["tips"])
async def create_tip(payload: TipCreate, service: TipService = Depends(get_tip_service)) -> TipRead:
    return await _run(service.create_tip(payload))


@router.get("/tips", response_model=TipPage, tags=["tips"])
async def list_tips(
    invoice_id: int | None = Query(default=None, ge=1, le=9_223_372_036_854_775_807),
    currency: Literal["USD", "EUR", "EGP"] | None = None,
    payment_method: Literal["CASH", "VISA"] | None = None,
    created_from: datetime | None = None,
    created_to: datetime | None = None,
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=100),
    service: TipService = Depends(get_tip_service),
) -> TipPage:
    if created_from is not None and created_to is not None and created_from > created_to:
        raise HTTPException(status_code=422, detail="created_from must be earlier than or equal to created_to")
    return await _run(service.list_tips(
        invoice_id=invoice_id, currency=currency, payment_method=payment_method,
        created_from=created_from, created_to=created_to, offset=offset, limit=limit,
    ))


@router.get("/invoices/{invoice_id}/tips", response_model=list[TipRead], tags=["tips"])
async def list_invoice_tips(
    invoice_id: InvoiceId, service: TipService = Depends(get_tip_service)
) -> list[TipRead]:
    return await _run(service.list_invoice_tips(invoice_id))
