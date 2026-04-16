"""POC configuration — all settings from environment variables via pydantic-settings."""

from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """All configuration is sourced from environment variables.

    For local development, place a ``.env`` file in the backend directory.
    """

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    # ── GCP Core ────────────────────────────────────────────────────────
    GCP_PROJECT_ID: str

    # ── BigQuery ────────────────────────────────────────────────────────
    BQ_DATASET: str = "rbac_demo"
    # Cap rows returned to the LLM from execute_bigquery_sql (full job still runs; avoids huge prompts).
    BQ_TOOL_MAX_ROWS: int = 500

    # ── Auth ────────────────────────────────────────────────────────────
    GOOGLE_CLIENT_ID: str

    # ── Vertex AI / Gemini ──────────────────────────────────────────────
    VERTEX_AI_LOCATION: str = "us-central1"
    GEMINI_FLASH_MODEL: str = "gemini-1.5-flash-001"
    GEMINI_PRO_MODEL: str = "gemini-1.5-pro-001"

    # ── URLs ────────────────────────────────────────────────────────────
    FRONTEND_URL: str = "http://localhost:5173"

    # ── Derived helpers ─────────────────────────────────────────────────
    @property
    def bq_prefix(self) -> str:
        """Fully-qualified dataset prefix, e.g. ``project.rbac_demo``."""
        return f"{self.GCP_PROJECT_ID}.{self.BQ_DATASET}"


# Singleton – import this everywhere
settings = Settings()  # type: ignore[call-arg]
