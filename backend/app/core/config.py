"""Application configuration loaded from environment variables."""

from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# Resolve .env relative to the backend root (two levels up from this file).
_ENV_FILE = Path(__file__).resolve().parents[2] / ".env"


class Settings(BaseSettings):
    """Central configuration for the Nile Villas system.

    Values are read from environment variables first, then from the `.env`
    file.  Every field without a default is **required** — the application
    will refuse to start if it is missing.
    """

    model_config = SettingsConfigDict(
        env_file=str(_ENV_FILE),
        env_file_encoding="utf-8",
        case_sensitive=True,
    )

    # ── General ──────────────────────────────────────────────────────────
    PROJECT_NAME: str = "Nile Villas System"
    API_V1_PREFIX: str = "/api/v1"

    # ── Database ─────────────────────────────────────────────────────────
    DATABASE_URL: str  # e.g. postgresql+psycopg://user:pass@host:5432/db
    ECHO_SQL: bool = False

    # ── Security ─────────────────────────────────────────────────────────
    SECRET_KEY: str


# Single, shared instance — import this wherever settings are needed.
settings = Settings()  # type: ignore[call-arg]

