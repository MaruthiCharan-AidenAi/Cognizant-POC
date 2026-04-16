"""JWT verification using Google's public keys.

Verifies Google-issued ID tokens and extracts the authenticated email.
Each verification may HTTP GET https://www.googleapis.com/oauth2/v3/certs;
transient disconnects are retried so follow-up /chat calls do not 500.
"""

from __future__ import annotations

import logging
import time
from typing import Any

import requests
from fastapi import HTTPException, Request, status
from google.auth.exceptions import TransportError
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

from config import settings

logger = logging.getLogger(__name__)

_VERIFY_ATTEMPTS = 3


def _build_google_transport() -> google_requests.Request:
    """Session with retries for JWKS / cert fetches (avoids flaky RemoteDisconnected)."""
    retry = Retry(
        total=5,
        connect=5,
        read=5,
        backoff_factor=0.4,
        status_forcelist=(429, 500, 502, 503, 504),
        allowed_methods=frozenset(["GET", "HEAD"]),
        raise_on_status=False,
    )
    adapter = HTTPAdapter(
        max_retries=retry,
        pool_connections=4,
        pool_maxsize=8,
    )
    session = requests.Session()
    session.mount("https://", adapter)
    session.headers["User-Agent"] = "analytics-chatbot-jwt-verify/1.0"
    return google_requests.Request(session=session)


# Re-usable transport (connection pool + urllib3 retries on Google's cert URL)
_GOOGLE_TRANSPORT = _build_google_transport()


async def verify_google_jwt(request: Request) -> dict[str, Any]:
    """Extract and verify the Google JWT from the Authorization header.

    Returns the decoded token payload on success.
    Raises ``HTTPException(401)`` on any failure.
    """
    auth_header: str | None = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or malformed Authorization header",
        )

    token = auth_header.removeprefix("Bearer ").strip()
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Empty bearer token",
        )

    payload: dict[str, Any] | None = None
    last_transport: TransportError | None = None

    for attempt in range(_VERIFY_ATTEMPTS):
        try:
            payload = id_token.verify_oauth2_token(
                token,
                _GOOGLE_TRANSPORT,
                audience=settings.GOOGLE_CLIENT_ID,
                clock_skew_in_seconds=60,
            )
            break
        except ValueError as exc:
            logger.warning("JWT verification failed: %s", exc)
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Invalid token: {exc}",
            ) from exc
        except TransportError as exc:
            last_transport = exc
            logger.warning(
                "Google JWKS fetch failed (attempt %s/%s): %s",
                attempt + 1,
                _VERIFY_ATTEMPTS,
                exc,
            )
            if attempt + 1 < _VERIFY_ATTEMPTS:
                time.sleep(0.25 * (2**attempt))

    if payload is None:
        logger.error("Giving up JWT verification after transport errors: %s", last_transport)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "Could not reach Google to verify your session. "
                "This is usually temporary — please try again in a few seconds."
            ),
        ) from last_transport

    email: str | None = payload.get("email")
    if not email:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token does not contain an email claim",
        )

    if not payload.get("email_verified", False):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email is not verified",
        )

    logger.info("Authenticated user: %s", email)
    return payload
