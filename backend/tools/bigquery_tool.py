"""ADK Tools — BigQuery function tools for ADK agents.

Each tool is a plain Python function with type hints and a docstring.
The ADK agent uses these to interact with BigQuery.
"""

from __future__ import annotations

import logging
import time
from typing import Any

from google.cloud import bigquery

from config import settings

logger = logging.getLogger(__name__)

_client: bigquery.Client | None = None


def _get_client() -> bigquery.Client:
    global _client
    if _client is None:
        _client = bigquery.Client(project=settings.GCP_PROJECT_ID)
    return _client


def execute_bigquery_sql(sql: str) -> dict[str, Any]:
    """Execute a BigQuery SQL query and return the results.

    Use this tool to run SQL queries against your authorized BigQuery view.
    The query will first be validated via dry-run, then executed.
    Returns a dict with 'rows' (list of dicts), 'row_count', 'bytes_scanned', and 'latency_ms'.
    Large result sets are truncated to settings.BQ_TOOL_MAX_ROWS rows (see 'truncated', 'total_rows', 'note').

    Args:
        sql: A valid BigQuery SQL query string.

    Returns:
        A dictionary with keys: rows, row_count, bytes_scanned, latency_ms.
        On error, returns a dict with key 'error'.
    """
    client = _get_client()

    # ── LOG the generated SQL for debugging ──────────────────────────────
    logger.info("=" * 60)
    logger.info("GENERATED SQL QUERY:")
    logger.info(sql)
    logger.info("=" * 60)

    # Dry-run first
    try:
        job_config = bigquery.QueryJobConfig(dry_run=True, use_query_cache=False)
        client.query(sql, job_config=job_config)
    except Exception as exc:
        logger.warning("Dry-run failed for SQL:\n%s\nError: %s", sql, exc)
        return {"error": f"SQL validation failed: {exc}"}

    # Execute
    start = time.monotonic()
    max_rows = settings.BQ_TOOL_MAX_ROWS
    try:
        query_job = client.query(sql)
        all_rows = [dict(row) for row in query_job.result()]
    except Exception as exc:
        logger.error("BigQuery execution failed: %s", exc)
        return {"error": f"BigQuery execution error: {exc}"}

    elapsed_ms = int((time.monotonic() - start) * 1000)
    bytes_scanned = query_job.total_bytes_processed or 0
    total_rows = len(all_rows)
    truncated = total_rows > max_rows
    rows = all_rows[:max_rows] if truncated else all_rows

    logger.info(
        "BigQuery execute — rows_returned=%d total_rows=%d bytes_scanned=%d latency_ms=%d truncated=%s",
        len(rows), total_rows, bytes_scanned, elapsed_ms, truncated,
    )

    # Serialize datetime objects to strings
    for row in rows:
        for k, v in row.items():
            if hasattr(v, "isoformat"):
                row[k] = v.isoformat()

    out: dict[str, Any] = {
        "rows": rows,
        "row_count": len(rows),
        "bytes_scanned": bytes_scanned,
        "latency_ms": elapsed_ms,
    }
    if truncated:
        out["total_rows"] = total_rows
        out["truncated"] = True
        out["note"] = (
            f"Results truncated to {max_rows} rows for the model; total_rows={total_rows}. "
            "Summarise using this sample or run a narrower query (aggregates, smaller date range)."
        )
    return out
