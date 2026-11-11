"""API v1 central router.

Every domain-specific router (rooms, bookings, guests, etc.) should be
included here so that ``app/main.py`` only needs to mount this single
router.
"""

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.catalog import router as catalog_router
from app.api.v1.invoices import router as invoices_router
from app.db.session import get_db

router = APIRouter()
router.include_router(catalog_router)
router.include_router(invoices_router)


@router.get("/health", tags=["health"])
async def health_check(db: AsyncSession = Depends(get_db)) -> JSONResponse:
    """Check that the API can reach PostgreSQL."""
    try:
        await db.execute(text("SELECT 1"))
    except SQLAlchemyError:
        return JSONResponse(status_code=503, content={"status": "unhealthy"})
    return JSONResponse(status_code=200, content={"status": "healthy"})


# ── Future domain routers are included below ─────────────────────────────
# from app.api.v1.endpoints import rooms, bookings, guests
# router.include_router(rooms.router, prefix="/rooms", tags=["rooms"])
# router.include_router(bookings.router, prefix="/bookings", tags=["bookings"])
# router.include_router(guests.router, prefix="/guests", tags=["guests"])

