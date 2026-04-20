"""Analytics Chatbot — FastAPI application entry point (POC with Google ADK).

Endpoints:
  POST /chat   — SSE streaming chat (Google OAuth JWT-authenticated)
  GET  /health — Healthcheck

Architecture:
  Frontend → POST /chat (Bearer JWT) →
  Verify JWT → Query user_access → Map role+region → VIEW →
  ADK Root Agent (auto-routes to sub-agents) → BigQuery VIEW → SSE response
"""

from __future__ import annotations

from contextlib import asynccontextmanager
import json
import logging
import time
from typing import Any, AsyncGenerator
from pydantic import BaseModel, Field

import uvicorn
from fastapi import FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from sse_starlette.sse import EventSourceResponse

from agents.adk_agents import run_agent, warmup_runner
from auth.google_auth import verify_google_jwt
from auth.rbac import resolve_user_context, verify_user_email
from config import settings
from models.chat import ChatErrorResponse, ChatRequest
from models.mock_data import get_mock_payload
from models.suggestions import SuggestionResponse, build_suggestion_questions

# ── Logging ─────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_: FastAPI):
    """Warm heavy singletons once to reduce first-turn latency."""
    warmup_runner()
    yield


# ── App ─────────────────────────────────────────────────────────────────
app = FastAPI(
    title="Analytics Chatbot API (ADK)",
    version="0.2.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)


@app.middleware("http")
async def log_requests(request: Request, call_next):
    started = time.monotonic()
    logger.info("HTTP request started: method=%s path=%s", request.method, request.url.path)
    try:
        response = await call_next(request)
    except Exception:
        latency_ms = int((time.monotonic() - started) * 1000)
        logger.exception(
            "HTTP request failed: method=%s path=%s latency_ms=%s",
            request.method,
            request.url.path,
            latency_ms,
        )
        raise

    latency_ms = int((time.monotonic() - started) * 1000)
    logger.info(
        "HTTP request completed: method=%s path=%s status=%s latency_ms=%s",
        request.method,
        request.url.path,
        response.status_code,
        latency_ms,
    )
    return response

# ── CORS ────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        settings.FRONTEND_URL,
        "http://localhost:3000",
        "http://localhost:5173",
        "http://localhost:4200"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Health ──────────────────────────────────────────────────────────────
@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "version": "0.2.0", "engine": "google-adk"}


# ── Auth / Login ─────────────────────────────────────────────────────────
@app.post("/auth/login")
async def login(request: Request) -> dict:
    """Verify Google OAuth JWT and confirm the email is registered.

    Returns user info (email, role, region) on success.
    Login succeeds as long as the email exists in BigQuery user_access —
    a role/region mapping to a view is NOT required at this stage.

    Raises:
        401: Missing/invalid JWT.
        403: Email not in user_access table.
        500: BigQuery unavailable.
    """
    token_payload = await verify_google_jwt(request)
    email: str = token_payload["email"]
    logger.info("Login attempt received for email=%s", email)
    user_row = await verify_user_email(email)
    logger.info(
        "BigQuery verification successful for email=%s role=%s region=%s",
        user_row["email"],
        user_row.get("role"),
        user_row.get("region"),
    )
    return {
        "status": "ok",
        "email": user_row["email"],
        "role": user_row.get("role"),
        "region": user_row.get("region"),
        "name": token_payload.get("name"),
        "picture": token_payload.get("picture"),
    }


# ── Chat ────────────────────────────────────────────────────────────────
@app.get("/suggestions", response_model=SuggestionResponse)
async def get_suggestions(request: Request) -> SuggestionResponse:
    """Return role-aware starter questions derived from the user's schema."""
    token_payload = await verify_google_jwt(request)
    email: str = token_payload["email"]
    user_ctx = await resolve_user_context(email)
    logger.info(
        "Suggestion request served: email=%s role=%s region=%s",
        email,
        user_ctx.role,
        user_ctx.region,
    )
    return SuggestionResponse(
        role=user_ctx.role,
        region=user_ctx.region,
        suggestions=build_suggestion_questions(user_ctx),
    )


@app.post("/chat")
async def chat(body: ChatRequest, request: Request) -> EventSourceResponse:
    """Main chat endpoint — SSE streaming response powered by Google ADK.

    Flow:
    1. Verify Google OAuth JWT
    2. Query BigQuery user_access → resolve role + region → select VIEW
    3. Pass message to ADK root agent (auto-routes to sub-agents)
    4. Sub-agent generates SQL ONLY against the authorized view
    5. Stream response chunks via SSE
    """
    start_time = time.monotonic()

    # Step 1: Verify Google OAuth JWT
    token_payload = await verify_google_jwt(request)
    email: str = token_payload["email"]
    logger.info("Chat request received: email=%s session_id=%s", email, body.session_id)

    # Step 2: Resolve user context (role + region + view)
    user_ctx = await resolve_user_context(email)
    logger.info(
        "User authenticated: email=%s role=%s region=%s view=%s",
        email, user_ctx.role, user_ctx.region, user_ctx.view_name,
    )

    # Step 3+4+5: Run ADK agent pipeline and stream SSE
    async def event_stream() -> AsyncGenerator[dict[str, str], None]:
        try:
            async for chunk in run_agent(
                user_message=body.message,
                session_id=body.session_id,
                user_ctx=user_ctx,
            ):
                yield {"data": json.dumps(chunk)}
        except Exception as exc:
            logger.exception(
                "SSE stream failed: email=%s session_id=%s error=%s",
                email,
                body.session_id,
                exc,
            )
            yield {"data": json.dumps({
                "type": "error",
                "error": "stream_error",
                "detail": "The response stream failed. Please retry.",
            })}
            yield {"data": json.dumps({"type": "done"})}
            return

        latency_ms = int((time.monotonic() - start_time) * 1000)
        logger.info(
            json.dumps({
                "user": email,
                "role": user_ctx.role,
                "region": user_ctx.region,
                "view": user_ctx.view_name,
                "question": body.message,
                "latency_ms": latency_ms,
                "session_id": body.session_id,
            })
        )

    return EventSourceResponse(event_stream())


# ── Mock Data ───────────────────────────────────────────────────────────
@app.get("/data")
async def mock_data(request: Request) -> dict:
    """Return role-aware synthetic chart data for frontend demos."""
    token_payload = await verify_google_jwt(request)
    email: str = token_payload["email"]
    user_ctx = await resolve_user_context(email)
    logger.info(
        "Mock data served: email=%s role=%s region=%s",
        email,
        user_ctx.role,
        user_ctx.region,
    )
    return get_mock_payload(user_ctx.role)


# ── Drill-Down ───────────────────────────────────────────────────────────
class DrillDownRequest(BaseModel):
    """Request body for the drill-down endpoint."""
    message: str = Field(..., min_length=1, max_length=4000)
    session_id: str = Field(..., min_length=1, max_length=128)
    drill_context: dict | None = None


@app.post("/drill-down")
async def drill_down(body: DrillDownRequest, request: Request) -> EventSourceResponse:
    """Drill-down endpoint — SSE streaming response, same pipeline as /chat.

    Streams tokens as they arrive so the frontend can render text
    character-by-character while charts and analysis build up progressively.
    """
    start_time = time.monotonic()

    token_payload = await verify_google_jwt(request)
    email: str = token_payload["email"]
    logger.info(
        "Drill-down request: email=%s session_id=%s label=%s",
        email,
        body.session_id,
        body.drill_context.get("clicked_label") if body.drill_context else None,
    )

    user_ctx = await resolve_user_context(email)

    drill_message = body.message
    if body.drill_context:
        ctx = body.drill_context
        drill_message = (
            f"{body.message}\n\n"
            f"[Drill-down context: chart='{ctx.get('chart_title')}', "
            f"segment='{ctx.get('clicked_label')}', value={ctx.get('clicked_value')}, "
            f"active_filters={ctx.get('filters', {})}, "
            f"original_chart_type='{ctx.get('original_chart_type')}']"
            f"\n\nProvide a focused breakdown for this segment with additional charts "
            f"showing sub-dimensions (e.g. by seller, by date, by program). "
            f"Use ```chart blocks for each chart. Be concise — no filler text."
        )

    async def event_stream() -> AsyncGenerator[dict[str, str], None]:
        try:
            async for chunk in run_agent(
                user_message=drill_message,
                session_id=body.session_id,
                user_ctx=user_ctx,
            ):
                yield {"data": json.dumps(chunk)}
        except Exception as exc:
            logger.exception(
                "Drill-down stream failed: email=%s session_id=%s error=%s",
                email, body.session_id, exc,
            )
            yield {"data": json.dumps({
                "type": "error",
                "error": "stream_error",
                "detail": "Drill-down stream failed. Please retry.",
            })}
            yield {"data": json.dumps({"type": "done"})}
            return

        latency_ms = int((time.monotonic() - start_time) * 1000)
        logger.info(
            json.dumps({
                "user": email,
                "role": user_ctx.role,
                "endpoint": "drill_down",
                "label": body.drill_context.get("clicked_label") if body.drill_context else None,
                "latency_ms": latency_ms,
                "session_id": body.session_id,
            })
        )

    return EventSourceResponse(event_stream())


# ── Error Handlers ──────────────────────────────────────────────────────
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException) -> Any:
    from fastapi.responses import JSONResponse
    return JSONResponse(
        status_code=exc.status_code,
        content=ChatErrorResponse(
            error=str(exc.status_code),
            detail=exc.detail,
        ).model_dump(),
    )


@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception) -> Any:
    from fastapi.responses import JSONResponse
    logger.exception("Unhandled exception: %s", exc)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content=ChatErrorResponse(
            error="internal_error",
            detail="An unexpected error occurred",
        ).model_dump(),
    )


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False, access_log=True)
