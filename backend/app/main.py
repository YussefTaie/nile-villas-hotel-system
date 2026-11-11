"""Nile Villas Hotel System — FastAPI application entry point."""

import asyncio
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
import sys

# On Windows, Psycopg 3's async driver requires the SelectorEventLoop.
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

from fastapi import FastAPI

from app.api.v1.router import router as v1_router
from app.core.config import settings
from app.db.session import engine


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncGenerator[None, None]:
    """Manage application-wide startup and shutdown resources."""
    # ── Startup ──────────────────────────────────────────────────────────
    # Nothing to acquire yet; the async engine connects lazily.
    yield
    # ── Shutdown ─────────────────────────────────────────────────────────
    await engine.dispose()


app = FastAPI(
    title=settings.PROJECT_NAME,
    lifespan=lifespan,
)

# Mount the v1 API router under its versioned prefix.
app.include_router(v1_router, prefix=settings.API_V1_PREFIX)

