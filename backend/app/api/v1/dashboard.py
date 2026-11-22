"""Dashboard financial summary endpoint."""

from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.session import get_db
from app.schemas.dashboard import DashboardSummary
from app.services.dashboard import DashboardService, InvalidReportingInterval

router = APIRouter()


def get_dashboard_service(db: AsyncSession = Depends(get_db)) -> DashboardService:
    return DashboardService(db, settings.REPORTING_TIMEZONE)


@router.get("/dashboard/summary", response_model=DashboardSummary, tags=["dashboard"])
async def get_dashboard_summary(
    start_date: date = Query(),
    end_date: date = Query(),
    service: DashboardService = Depends(get_dashboard_service),
) -> DashboardSummary:
    if start_date > end_date:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="start_date must be earlier than or equal to end_date",
        )
    try:
        return await service.summarize(start_date=start_date, end_date=end_date)
    except InvalidReportingInterval as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail=str(exc)) from exc
