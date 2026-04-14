"""RBAC — resolve email → role + region → authorized BigQuery view.

Queries the ``user_access`` table in BigQuery. If the user is found,
maps their (role, region) to a specific pre-created view. If not found,
blocks access with HTTP 403.

Two entry-points:
  - ``verify_user_email``    : lightweight login check — only confirms the
                               email exists in ``user_access``.  Returns the
                               raw row so the caller can use role/region.
  - ``resolve_user_context`` : full RBAC check — requires a valid (role,
                               region) → view mapping.  Used on /chat.
"""

from __future__ import annotations

import logging

from fastapi import HTTPException, status
from google.cloud import bigquery

from config import settings
from models.user_context import VIEW_MAP, UserContext

logger = logging.getLogger(__name__)

_bq_client: bigquery.Client | None = None


def _get_bq_client() -> bigquery.Client:
    global _bq_client
    if _bq_client is None:
        _bq_client = bigquery.Client(project=settings.GCP_PROJECT_ID)
    return _bq_client


def _query_user_row(email: str) -> dict | None:
    """Run a parameterised query against user_access. Returns the first row as
    a plain dict, or ``None`` if the email is not found.

    Raises ``HTTPException(500)`` if the BigQuery call itself fails.
    """
    client = _get_bq_client()

    query = f"""
        SELECT email, role, region
        FROM `{settings.bq_prefix}.user_access`
        WHERE email = @email
        LIMIT 1
    """
    job_config = bigquery.QueryJobConfig(
        query_parameters=[
            bigquery.ScalarQueryParameter("email", "STRING", email),
        ]
    )

    try:
        rows = list(client.query(query, job_config=job_config).result())
    except Exception as exc:
        err_msg = str(exc)
        logger.error("BigQuery query failed for %s: %s", email, err_msg)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unable to verify user permissions: {err_msg}",
        ) from exc

    if not rows:
        return None

    row = rows[0]
    return {
        "email": row["email"],
        "role": row["role"],
        "region": row["region"],
    }


async def verify_user_email(email: str) -> dict:
    """Lightweight login check — confirms the email exists in user_access.

    Returns the raw row dict (email, role, region) so the frontend can
    show the user their role.

    Raises:
        HTTPException(403): Email not registered in the system.
        HTTPException(500): BigQuery call failed.
    """
    row = _query_user_row(email)
    if row is None:
        logger.warning("Login denied — no record for %s", email)
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied — your email is not registered in the system",
        )
    logger.info("Login accepted for %s (role=%s region=%s)", email, row.get("role"), row.get("region"))
    return row


async def resolve_user_context(email: str) -> UserContext:
    """Full RBAC check — email must exist AND have a valid (role, region) view.

    Flow:
    1. Query ``rbac_demo.user_access`` for the email
    2. Extract role + region
    3. Map (role, region) → view name via VIEW_MAP
    4. Return UserContext with the authorized view

    Raises:
        HTTPException(403): Email not found OR no view mapped for role/region.
        HTTPException(500): BigQuery call failed.
    """
    row = _query_user_row(email)

    if row is None:
        logger.warning("Access denied — no record for %s", email)
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied — your email is not registered in the system",
        )

    role: str = row["role"] or ""
    region: str = row["region"] or ""

    # Map to view
    view_name = VIEW_MAP.get((role, region))
    if not view_name:
        logger.warning(
            "No view mapping for role=%s region=%s (email=%s)", role, region, email
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"No data view configured for role '{role}' in region '{region}'",
        )

    ctx = UserContext(
        email=email,
        role=role,
        region=region,
        view_name=view_name,
    )
    logger.info(
        "Resolved %s → role=%s region=%s view=%s", email, role, region, view_name
    )
    return ctx
