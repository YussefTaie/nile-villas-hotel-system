"""Dashboard reporting use cases and operational-timezone boundaries."""

from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.repositories.dashboard import DashboardRepository


class InvalidReportingInterval(Exception):
    pass


class DashboardService:
    def __init__(self, session: AsyncSession, timezone_name: str | None = None) -> None:
        self.repository = DashboardRepository(session)
        self.timezone_name = timezone_name or settings.REPORTING_TIMEZONE
        self.reporting_timezone = ZoneInfo(self.timezone_name)

    async def summarize(self, *, start_date: date, end_date: date) -> dict[str, object]:
        if start_date > end_date:
            raise InvalidReportingInterval("start_date must be earlier than or equal to end_date")
        try:
            local_start = datetime.combine(start_date, time.min, self.reporting_timezone)
            local_end = datetime.combine(end_date + timedelta(days=1), time.min, self.reporting_timezone)
        except OverflowError as exc:
            raise InvalidReportingInterval("Reporting date interval is out of range") from exc

        interval_start = local_start.astimezone(timezone.utc)
        interval_end = local_end.astimezone(timezone.utc)
        summary = await self.repository.summarize(
            interval_start=interval_start,
            interval_end=interval_end,
        )
        return {
            "period": {
                "start_date": start_date,
                "end_date": end_date,
                "timezone": self.timezone_name,
            },
            **summary,
        }
