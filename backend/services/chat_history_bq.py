"""BigQuery persistence for chat sessions and messages."""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import Any

from google.cloud import bigquery

from config import settings

logger = logging.getLogger(__name__)

_client: bigquery.Client | None = None

DEFAULT_TITLE = "New chat"


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _get_client() -> bigquery.Client:
    global _client
    if _client is None:
        _client = bigquery.Client(project=settings.GCP_PROJECT_ID)
    return _client


def _sessions_table() -> str:
    return f"`{settings.bq_prefix}.{settings.BQ_CHAT_SESSIONS_TABLE}`"


def _messages_table() -> str:
    return f"`{settings.bq_prefix}.{settings.BQ_CHAT_MESSAGES_TABLE}`"


async def list_sessions(user_email: str, limit: int = 50) -> list[dict[str, Any]]:
    client = _get_client()
    q = f"""
        SELECT
          s.session_id,
          s.title,
          s.created_at,
          s.updated_at,
          COUNTIF(m.role = 'user') AS user_message_count
        FROM {_sessions_table()} AS s
        LEFT JOIN {_messages_table()} AS m
          ON m.session_id = s.session_id AND m.user_email = s.user_email
        WHERE s.user_email = @email
        GROUP BY s.session_id, s.title, s.created_at, s.updated_at
        ORDER BY s.updated_at DESC
        LIMIT @limit
    """
    job_config = bigquery.QueryJobConfig(
        query_parameters=[
            bigquery.ScalarQueryParameter("email", "STRING", user_email),
            bigquery.ScalarQueryParameter("limit", "INT64", limit),
        ]
    )
    rows = list(client.query(q, job_config=job_config).result())
    return [dict(r) for r in rows]


async def ensure_session(user_email: str, session_id: str, title: str | None = None) -> None:
    client = _get_client()
    now = _utcnow()
    t = title if title else DEFAULT_TITLE
    q = f"""
        MERGE {_sessions_table()} T
        USING (
          SELECT @session_id AS session_id, @email AS user_email
        ) S
        ON T.session_id = S.session_id AND T.user_email = S.user_email
        WHEN NOT MATCHED THEN
          INSERT (session_id, user_email, title, created_at, updated_at)
          VALUES (@session_id, @email, @title, @ts, @ts)
    """
    job_config = bigquery.QueryJobConfig(
        query_parameters=[
            bigquery.ScalarQueryParameter("session_id", "STRING", session_id),
            bigquery.ScalarQueryParameter("email", "STRING", user_email),
            bigquery.ScalarQueryParameter("title", "STRING", t),
            bigquery.ScalarQueryParameter("ts", "TIMESTAMP", now),
        ]
    )
    client.query(q, job_config=job_config).result()


async def touch_session(user_email: str, session_id: str) -> None:
    client = _get_client()
    q = f"""
        UPDATE {_sessions_table()}
        SET updated_at = @ts
        WHERE session_id = @session_id AND user_email = @email
    """
    job_config = bigquery.QueryJobConfig(
        query_parameters=[
            bigquery.ScalarQueryParameter("ts", "TIMESTAMP", _utcnow()),
            bigquery.ScalarQueryParameter("session_id", "STRING", session_id),
            bigquery.ScalarQueryParameter("email", "STRING", user_email),
        ]
    )
    client.query(q, job_config=job_config).result()


async def update_session_title(user_email: str, session_id: str, title: str) -> bool:
    client = _get_client()
    title = title.strip()
    if not title:
        return False
    q = f"""
        UPDATE {_sessions_table()}
        SET title = @title, updated_at = @ts
        WHERE session_id = @session_id AND user_email = @email
    """
    job_config = bigquery.QueryJobConfig(
        query_parameters=[
            bigquery.ScalarQueryParameter("title", "STRING", title[:512]),
            bigquery.ScalarQueryParameter("ts", "TIMESTAMP", _utcnow()),
            bigquery.ScalarQueryParameter("session_id", "STRING", session_id),
            bigquery.ScalarQueryParameter("email", "STRING", user_email),
        ]
    )
    job = client.query(q, job_config=job_config)
    job.result()
    return (job.num_dml_affected_rows or 0) > 0


async def get_session(user_email: str, session_id: str) -> dict[str, Any] | None:
    client = _get_client()
    q = f"""
        SELECT session_id, user_email, title, created_at, updated_at
        FROM {_sessions_table()}
        WHERE session_id = @session_id AND user_email = @email
        LIMIT 1
    """
    job_config = bigquery.QueryJobConfig(
        query_parameters=[
            bigquery.ScalarQueryParameter("session_id", "STRING", session_id),
            bigquery.ScalarQueryParameter("email", "STRING", user_email),
        ]
    )
    rows = list(client.query(q, job_config=job_config).result())
    return dict(rows[0]) if rows else None


async def count_user_messages(user_email: str, session_id: str) -> int:
    client = _get_client()
    q = f"""
        SELECT COUNT(1) AS c
        FROM {_messages_table()}
        WHERE session_id = @session_id AND user_email = @email AND role = 'user'
    """
    job_config = bigquery.QueryJobConfig(
        query_parameters=[
            bigquery.ScalarQueryParameter("session_id", "STRING", session_id),
            bigquery.ScalarQueryParameter("email", "STRING", user_email),
        ]
    )
    rows = list(client.query(q, job_config=job_config).result())
    return int(rows[0]["c"]) if rows else 0


async def list_messages_for_context(
    user_email: str,
    session_id: str,
    max_turns: int,
) -> list[dict[str, Any]]:
    """Return messages in chronological order (oldest first), capped to last max_turns * 2 rows."""
    client = _get_client()
    cap = max(1, max_turns) * 2
    q = f"""
        SELECT role, content, created_at, message_id
        FROM {_messages_table()}
        WHERE session_id = @session_id AND user_email = @email
        ORDER BY created_at DESC
        LIMIT @cap
    """
    job_config = bigquery.QueryJobConfig(
        query_parameters=[
            bigquery.ScalarQueryParameter("session_id", "STRING", session_id),
            bigquery.ScalarQueryParameter("email", "STRING", user_email),
            bigquery.ScalarQueryParameter("cap", "INT64", cap),
        ]
    )
    rows = list(client.query(q, job_config=job_config).result())
    rows.reverse()
    return [dict(r) for r in rows]


async def list_messages_for_api(user_email: str, session_id: str) -> list[dict[str, Any]]:
    client = _get_client()
    q = f"""
        SELECT message_id, role, content, created_at
        FROM {_messages_table()}
        WHERE session_id = @session_id AND user_email = @email
        ORDER BY created_at ASC
    """
    job_config = bigquery.QueryJobConfig(
        query_parameters=[
            bigquery.ScalarQueryParameter("session_id", "STRING", session_id),
            bigquery.ScalarQueryParameter("email", "STRING", user_email),
        ]
    )
    rows = list(client.query(q, job_config=job_config).result())
    return [dict(r) for r in rows]


async def insert_message(
    user_email: str,
    session_id: str,
    role: str,
    content: str,
    *,
    embedding_model: str | None = None,
    vector_datapoint_id: str | None = None,
) -> str:
    client = _get_client()
    message_id = str(uuid.uuid4())
    q = f"""
        INSERT INTO {_messages_table()} (
          message_id, session_id, user_email, role, content, created_at,
          embedding_model, vector_datapoint_id
        )
        VALUES (
          @message_id, @session_id, @email, @role, @content, @ts,
          @embedding_model, @vector_datapoint_id
        )
    """
    job_config = bigquery.QueryJobConfig(
        query_parameters=[
            bigquery.ScalarQueryParameter("message_id", "STRING", message_id),
            bigquery.ScalarQueryParameter("session_id", "STRING", session_id),
            bigquery.ScalarQueryParameter("email", "STRING", user_email),
            bigquery.ScalarQueryParameter("role", "STRING", role),
            bigquery.ScalarQueryParameter("content", "STRING", content),
            bigquery.ScalarQueryParameter("ts", "TIMESTAMP", _utcnow()),
            bigquery.ScalarQueryParameter(
                "embedding_model", "STRING", embedding_model or ""
            ),
            bigquery.ScalarQueryParameter(
                "vector_datapoint_id", "STRING", vector_datapoint_id or ""
            ),
        ]
    )
    client.query(q, job_config=job_config).result()
    await touch_session(user_email, session_id)
    return message_id


async def fetch_messages_by_ids(user_email: str, message_ids: list[str]) -> dict[str, dict[str, Any]]:
    if not message_ids:
        return {}
    client = _get_client()
    q = f"""
        SELECT message_id, session_id, role, content, created_at
        FROM {_messages_table()}
        WHERE user_email = @email
          AND message_id IN UNNEST(@ids)
    """
    job_config = bigquery.QueryJobConfig(
        query_parameters=[
            bigquery.ScalarQueryParameter("email", "STRING", user_email),
            bigquery.ArrayQueryParameter("ids", "STRING", message_ids),
        ]
    )
    rows = list(client.query(q, job_config=job_config).result())
    return {str(r["message_id"]): dict(r) for r in rows}


async def search_sessions_semantic(
    user_email: str,
    neighbor_message_ids: list[str],
    limit: int = 8,
) -> list[dict[str, Any]]:
    """Map retrieved message ids to session previews (title, snippet)."""
    if not neighbor_message_ids:
        return []
    client = _get_client()
    q = f"""
        WITH hits AS (
          SELECT m.session_id, m.message_id, m.role, m.content, m.created_at
          FROM {_messages_table()} AS m
          WHERE m.user_email = @email
            AND m.message_id IN UNNEST(@ids)
        ),
        ranked AS (
          SELECT
            h.*,
            s.title AS session_title,
            ROW_NUMBER() OVER (PARTITION BY h.session_id ORDER BY h.created_at DESC) AS rn
          FROM hits AS h
          JOIN {_sessions_table()} AS s
            ON s.session_id = h.session_id AND s.user_email = @email
        )
        SELECT session_id, session_title, message_id, role, content, created_at
        FROM ranked
        WHERE rn = 1
        LIMIT @limit
    """
    job_config = bigquery.QueryJobConfig(
        query_parameters=[
            bigquery.ScalarQueryParameter("email", "STRING", user_email),
            bigquery.ArrayQueryParameter("ids", "STRING", neighbor_message_ids),
            bigquery.ScalarQueryParameter("limit", "INT64", limit),
        ]
    )
    rows = list(client.query(q, job_config=job_config).result())
    return [dict(r) for r in rows]
