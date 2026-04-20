"""Post-turn persistence: assistant message, embeddings, vector index, title."""

from __future__ import annotations

import asyncio
import logging

from config import settings
from services import chat_history_bq, embeddings, title_generator, vector_search

logger = logging.getLogger(__name__)

DEFAULT_TITLE = chat_history_bq.DEFAULT_TITLE


def schedule_post_turn_work(
    user_email: str,
    session_id: str,
    user_message: str,
    assistant_text: str,
    user_message_id: str,
    is_first_exchange: bool,
) -> None:
    async def _run() -> None:
        try:
            await _post_turn(
                user_email=user_email,
                session_id=session_id,
                user_message=user_message,
                assistant_text=assistant_text,
                user_message_id=user_message_id,
                is_first_exchange=is_first_exchange,
            )
        except Exception:
            logger.exception("post_turn background task failed")

    asyncio.create_task(_run())


async def _post_turn(
    user_email: str,
    session_id: str,
    user_message: str,
    assistant_text: str,
    user_message_id: str,
    is_first_exchange: bool,
) -> None:
    try:
        await chat_history_bq.insert_message(
            user_email,
            session_id,
            "assistant",
            assistant_text,
            embedding_model=None,
            vector_datapoint_id=None,
        )
    except Exception:
        logger.exception("Failed to persist assistant message")

    if vector_search.vector_search_configured():
        try:
            vec = embeddings.embed_text(user_message)
            vector_search.upsert_message_vector(user_message_id, vec, user_email)
            await chat_history_bq.touch_session(user_email, session_id)
        except Exception:
            logger.exception("Failed to embed / upsert user message vector")

    if not is_first_exchange:
        return
    try:
        session = await chat_history_bq.get_session(user_email, session_id)
        cur_title = (session or {}).get("title") or ""
        if cur_title and cur_title != DEFAULT_TITLE:
            return
        title = title_generator.generate_chat_title(user_message, assistant_text)
        await chat_history_bq.update_session_title(user_email, session_id, title)
    except Exception:
        logger.exception("Failed to generate or save chat title")


async def build_retrieval_context(
    user_email: str,
    session_id: str,
    user_message: str,
    exclude_message_ids: set[str] | None = None,
) -> str:
    if not vector_search.vector_search_configured():
        return ""
    try:
        qvec = embeddings.embed_text(user_message)
    except Exception:
        logger.exception("Embedding failed for retrieval")
        return ""

    neighbors = vector_search.find_similar_message_ids(
        qvec,
        settings.CHAT_RETRIEVAL_MAX_NEIGHBORS * 3,
        exclude_datapoint_ids=exclude_message_ids,
    )
    ids = [n["datapoint_id"] for n in neighbors][: settings.CHAT_RETRIEVAL_MAX_NEIGHBORS * 3]
    if not ids:
        return ""
    rows = await chat_history_bq.fetch_messages_by_ids(user_email, ids)
    lines: list[str] = []
    seen = set()
    for nid in ids:
        row = rows.get(nid)
        if not row or row.get("session_id") == session_id:
            continue
        if nid in seen:
            continue
        seen.add(nid)
        content = (row.get("content") or "").strip()
        if not content:
            continue
        role = row.get("role") or "user"
        lines.append(f"- ({role}) {content[:400]}{'…' if len(content) > 400 else ''}")
        if len(lines) >= settings.CHAT_RETRIEVAL_MAX_NEIGHBORS:
            break

    if not lines:
        return ""
    return (
        "[RELEVANT EARLIER CHATS — same user, other sessions; use only if it helps this question]\n"
        + "\n".join(lines)
    )
