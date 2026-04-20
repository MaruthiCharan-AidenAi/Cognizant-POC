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
    BQ_DATASET: str = "cognizant_poc"
    # Main source-of-truth table — used for RBAC lookups (people_data.google_email, role, region).
    BQ_MAIN_TABLE: str = "bqdata"
    # Chat history tables (create with sql/chat_history_schema.sql).
    BQ_CHAT_SESSIONS_TABLE: str = "chat_sessions"
    BQ_CHAT_MESSAGES_TABLE: str = "chat_messages"
    # Cap rows returned to the LLM from execute_bigquery_sql (full job still runs; avoids huge prompts).
    BQ_TOOL_MAX_ROWS: int = 500

    # ── Auth ────────────────────────────────────────────────────────────
    GOOGLE_CLIENT_ID: str

    # ── Vertex AI / Gemini ──────────────────────────────────────────────
    VERTEX_AI_LOCATION: str = "us-central1"
    GEMINI_FLASH_MODEL: str = "gemini-1.5-flash-001"
    GEMINI_PRO_MODEL: str = "gemini-1.5-pro-001"
    # Text embeddings (Vertex AI). Dimension must match the Vector Search index.
    VERTEX_EMBEDDING_MODEL: str = "gemini-embedding-001"
    # For gemini-embedding-001 you can request lower dimensions (e.g. 768) to match an existing index.
    VERTEX_EMBEDDING_DIMENSIONS: int = 768

    # ── Vertex AI Vector Search (Matching Engine) — optional ────────────
    # Full resource name of the Index used for streaming upserts, e.g.
    # projects/PROJECT/locations/us-central1/indexes/INDEX_ID
    VERTEX_VECTOR_SEARCH_INDEX_ID: str = ""
    # Full resource name of the IndexEndpoint, e.g.
    # projects/PROJECT/locations/us-central1/indexEndpoints/ENDPOINT_ID
    VERTEX_VECTOR_SEARCH_INDEX_ENDPOINT_ID: str = ""
    # Deployed index id as shown on the endpoint (string).
    VERTEX_VECTOR_SEARCH_DEPLOYED_INDEX_ID: str = ""

    # How many prior turns to inject into the model context (from BigQuery).
    CHAT_HISTORY_MAX_TURNS: int = 24
    # Retrieved similar user messages for grounding (Vector Search).
    CHAT_RETRIEVAL_MAX_NEIGHBORS: int = 5

    # ── URLs ────────────────────────────────────────────────────────────
    FRONTEND_URL: str = "http://localhost:5173"

    # ── Derived helpers ─────────────────────────────────────────────────
    @property
    def bq_prefix(self) -> str:
        """Fully-qualified dataset prefix, e.g. ``project.rbac_demo``."""
        return f"{self.GCP_PROJECT_ID}.{self.BQ_DATASET}"


# Singleton – import this everywhere
settings = Settings()  # type: ignore[call-arg]
