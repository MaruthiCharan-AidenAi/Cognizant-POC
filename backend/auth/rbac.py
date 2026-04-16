"""RBAC — resolve email → role + region → authorized BigQuery view.

Queries the main ``bqdata`` table in BigQuery using ``people_data.google_email``
for the email lookup, ``people_data.role`` for the role, and
``off_onboarding_region`` for the region.

No separate user_access table is needed — the main dataset is the source of truth.

Role values in people_data.role are normalized to internal VIEW_MAP keys:
  "Seller"               → seller
  "Ops Lead"             → ops_lead
  "Quality Analyst"      → quality_analyst
  "Data Contributor"     → data_contributor
  "System Administrator" → sys_admin
  "PEX Team"             → pex_team

Two entry-points:
  - ``verify_user_email``    : lightweight login check — only confirms the
                               email exists in bqdata.  Returns the raw row
                               so the caller can use role/region.
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

# ── Role normalisation ───────────────────────────────────────────────────
# Maps the human-readable role strings stored in people_data.role
# (case-insensitive) to the internal VIEW_MAP keys.
_ROLE_NORMALISATION: dict[str, str] = {
    "seller":               "seller",
    "ops lead":             "ops_lead",
    "ops_lead":             "ops_lead",
    "quality analyst":      "quality_analyst",
    "quality_analyst":      "quality_analyst",
    "data contributor":     "data_contributor",
    "data_contributor":     "data_contributor",
    "system administrator": "sys_admin",
    "sys admin":            "sys_admin",
    "sys_admin":            "sys_admin",
    "administrator":        "sys_admin",
    "pex team":             "pex_team",
    "pex_team":             "pex_team",
    "pex":                  "pex_team",
}


def _normalise_role(raw_role: str) -> str | None:
    """Convert a raw role string from people_data.role to an internal VIEW_MAP key.

    Returns ``None`` if the role is unrecognised.
    """
    return _ROLE_NORMALISATION.get(raw_role.strip().lower())


def _get_bq_client() -> bigquery.Client:
    global _bq_client
    if _bq_client is None:
        _bq_client = bigquery.Client(project=settings.GCP_PROJECT_ID)
    return _bq_client


def _query_user_row(email: str) -> dict | None:
    """Look up a user by email in the main bqdata table.

    Reads people_data.google_email (email), people_data.role (role),
    and off_onboarding_region (region).

    Returns the first matching row as a plain dict with keys
    ``email``, ``raw_role``, and ``region``, or ``None`` if not found.

    Raises ``HTTPException(500)`` if the BigQuery call itself fails.
    """
    client = _get_bq_client()
    fq_table = f"`{settings.bq_prefix}.{settings.BQ_MAIN_TABLE}`"

    # DISTINCT to collapse duplicates — bqdata has many rows per person
    # (one per company/quarter). We only need one to determine identity.
    query = f"""
        SELECT DISTINCT
          people_data.google_email AS email,
          people_data.role         AS raw_role,
          off_onboarding_region    AS region
        FROM {fq_table}
        WHERE people_data.google_email = @email
          AND people_data.google_email IS NOT NULL
          AND people_data.role IS NOT NULL
          AND off_onboarding_region IS NOT NULL
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
        logger.error("BigQuery user lookup failed for %s: %s", email, err_msg)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unable to verify user permissions: {err_msg}",
        ) from exc

    if not rows:
        return None

    row = rows[0]
    return {
        "email":    row["email"],
        "raw_role": row["raw_role"],
        "region":   row["region"],
    }


async def verify_user_email(email: str) -> dict:
    """Lightweight login check — confirms the email exists in bqdata.

    Returns a dict with email, role (normalised), and region so the
    frontend can show the user their role.

    Raises:
        HTTPException(403): Email not found in bqdata / role unrecognised.
        HTTPException(500): BigQuery call failed.
    """
    row = _query_user_row(email)
    if row is None:
        logger.warning("Login denied — no record for %s", email)
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied — your email is not registered in the system",
        )

    normalised = _normalise_role(row["raw_role"])
    if normalised is None:
        logger.warning(
            "Login denied — unrecognised role '%s' for %s", row["raw_role"], email
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Access denied — unrecognised role '{row['raw_role']}'",
        )

    logger.info(
        "Login accepted for %s (raw_role=%s → role=%s region=%s)",
        email, row["raw_role"], normalised, row["region"],
    )
    return {
        "email":  row["email"],
        "role":   normalised,
        "region": row["region"],
    }


async def resolve_user_context(email: str) -> UserContext:
    """Full RBAC check — email must exist AND have a valid (role, region) view.

    Flow:
    1. Query bqdata.people_data for the email → extract raw_role + off_onboarding_region
    2. Normalise raw_role → internal role key
    3. Map (role, region) → view name via VIEW_MAP
    4. Return UserContext with the authorized view

    Raises:
        HTTPException(403): Email not found OR role unrecognised OR no view mapping.
        HTTPException(500): BigQuery call failed.
    """
    row = _query_user_row(email)

    if row is None:
        logger.warning("Access denied — no record for %s", email)
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied — your email is not registered in the system",
        )

    raw_role: str = row["raw_role"] or ""
    region: str = row["region"] or ""

    role = _normalise_role(raw_role)
    if role is None:
        logger.warning(
            "No role normalisation for raw_role='%s' (email=%s)", raw_role, email
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Access denied — unrecognised role '{raw_role}'",
        )

    # Map to view
    view_name = VIEW_MAP.get((role, region))
    if not view_name:
        logger.warning(
            "No view mapping for role=%s region=%s (email=%s)", role, region, email
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"No data view configured for role '{raw_role}' in region '{region}'",
        )

    ctx = UserContext(
        email=email,
        role=role,
        region=region,
        view_name=view_name,
    )
    logger.info(
        "Resolved %s → raw_role='%s' role=%s region=%s view=%s",
        email, raw_role, role, region, view_name,
    )
    return ctx
