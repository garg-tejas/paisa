"""Application configuration.

Loads settings from environment variables / a local .env file using
pydantic-settings. Every other module imports the singleton `settings`.
"""

from __future__ import annotations

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime configuration, populated from the environment / .env."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # Postgres connection string (Neon, Railway, local, ...).
    # asyncpg accepts the standard postgres:// / postgresql:// URL form.
    DATABASE_URL: str = "postgresql://postgres:postgres@localhost:5432/paisa"

    # Z.ai GLM API key (OCR + structuring). Required for parse routes to work.
    GLM_API_KEY: str = ""

    # Web Push (VAPID) credentials. Generate with `vapid` / py_vapid or web-push.
    VAPID_PRIVATE_KEY: str = ""
    VAPID_PUBLIC_KEY: str = ""
    VAPID_EMAIL: str = "admin@example.com"

    # CORS: comma-separated list of allowed origins, or "*" for all.
    CORS_ORIGINS: str = "*"

    # Server port (used by the Dockerfile CMD / uvicorn).
    PORT: int = 8000

    @property
    def cors_origins_list(self) -> list[str]:
        """Parse CORS_ORIGINS into a list for the CORS middleware."""
        raw = (self.CORS_ORIGINS or "").strip()
        if raw == "" or raw == "*":
            return ["*"]
        return [origin.strip() for origin in raw.split(",") if origin.strip()]


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return the cached settings singleton."""
    return Settings()


# Module-level singleton for convenient importing: `from app.config import settings`.
settings = get_settings()
