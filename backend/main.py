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

import json
import logging
import time
from typing import Any, AsyncGenerator

import uvicorn
from fastapi import FastAPI, HTTPException, Query, Request, status
from fastapi.middleware.cors import CORSMiddleware
from sse_starlette.sse import EventSourceResponse

from agents.adk_agents import run_agent
from auth.google_auth import verify_google_jwt
from auth.rbac import resolve_user_context, verify_user_email
from config import settings
from models.chat import ChatErrorResponse, ChatRequest
from models.session import (
    ChatMessageOut,
    SemanticSearchHit,
    SemanticSearchResponse,
    SessionListResponse,
    SessionMessagesResponse,
    SessionSummary,
    SessionTitleUpdate,
)
from models.suggestions import SuggestionResponse, build_suggestion_questions
from services import chat_history_bq, chat_turn, embeddings, vector_search

# ── Logging ─────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

# ── App ─────────────────────────────────────────────────────────────────
app = FastAPI(
    title="Analytics Chatbot API (ADK)",
    version="0.2.0",
    docs_url="/docs",
    redoc_url="/redoc",
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
@app.get("/sessions", response_model=SessionListResponse)
async def list_sessions(request: Request) -> SessionListResponse:
    token_payload = await verify_google_jwt(request)
    email: str = token_payload["email"]
    rows = await chat_history_bq.list_sessions(email)
    sessions = [
        SessionSummary(
            session_id=r["session_id"],
            title=r.get("title"),
            created_at=r.get("created_at"),
            updated_at=r.get("updated_at"),
            user_message_count=int(r.get("user_message_count") or 0),
        )
        for r in rows
    ]
    return SessionListResponse(sessions=sessions)


@app.get("/sessions/{session_id}/messages", response_model=SessionMessagesResponse)
async def get_session_messages(session_id: str, request: Request) -> SessionMessagesResponse:
    token_payload = await verify_google_jwt(request)
    email: str = token_payload["email"]
    rows = await chat_history_bq.list_messages_for_api(email, session_id)
    return SessionMessagesResponse(
        session_id=session_id,
        messages=[
            ChatMessageOut(
                message_id=r["message_id"],
                role=r["role"],
                content=r["content"],
                created_at=r.get("created_at"),
            )
            for r in rows
        ],
    )


@app.patch("/sessions/{session_id}")
async def rename_session(
    session_id: str,
    body: SessionTitleUpdate,
    request: Request,
) -> dict[str, str]:
    token_payload = await verify_google_jwt(request)
    email: str = token_payload["email"]
    ok = await chat_history_bq.update_session_title(email, session_id, body.title)
    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    return {"status": "ok", "session_id": session_id, "title": body.title.strip()[:512]}


@app.get("/search/messages", response_model=SemanticSearchResponse)
async def semantic_search_messages(
    request: Request,
    q: str = Query(..., min_length=1, max_length=2000),
) -> SemanticSearchResponse:
    token_payload = await verify_google_jwt(request)
    email: str = token_payload["email"]
    if not vector_search.vector_search_configured():
        return SemanticSearchResponse(hits=[])
    try:
        qvec = embeddings.embed_text(q)
    except Exception as exc:
        logger.warning("Search embed failed: %s", exc)
        return SemanticSearchResponse(hits=[])
    neighbors = vector_search.find_similar_message_ids(
        qvec,
        max(settings.CHAT_RETRIEVAL_MAX_NEIGHBORS * 4, 12),
    )
    ids = [n["datapoint_id"] for n in neighbors]
    previews = await chat_history_bq.search_sessions_semantic(email, ids, limit=12)
    hits = [
        SemanticSearchHit(
            session_id=p["session_id"],
            session_title=p.get("session_title"),
            message_id=p["message_id"],
            role=p["role"],
            content=p["content"],
            created_at=p.get("created_at"),
        )
        for p in previews
    ]
    return SemanticSearchResponse(hits=hits)


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

    await chat_history_bq.ensure_session(email, body.session_id)
    prior_user_count = await chat_history_bq.count_user_messages(email, body.session_id)
    history_rows = await chat_history_bq.list_messages_for_context(
        email,
        body.session_id,
        settings.CHAT_HISTORY_MAX_TURNS,
    )
    history_pairs = [(str(r["role"]), str(r["content"])) for r in history_rows]
    retrieval = await chat_turn.build_retrieval_context(
        email,
        body.session_id,
        body.message,
    )
    user_message_id = await chat_history_bq.insert_message(
        email,
        body.session_id,
        "user",
        body.message,
    )

    # Step 3+4+5: Run ADK agent pipeline and stream SSE
    async def event_stream() -> AsyncGenerator[dict[str, str], None]:
        assistant_text = ""
        try:
            async for chunk in run_agent(
                user_message=body.message,
                session_id=body.session_id,
                user_ctx=user_ctx,
                history_pairs=history_pairs,
                retrieval_context=retrieval or None,
            ):
                if chunk.get("type") == "token":
                    assistant_text += chunk.get("content", "")
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
        if assistant_text.strip():
            chat_turn.schedule_post_turn_work(
                user_email=email,
                session_id=body.session_id,
                user_message=body.message,
                assistant_text=assistant_text,
                user_message_id=user_message_id,
                is_first_exchange=(prior_user_count == 0),
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
