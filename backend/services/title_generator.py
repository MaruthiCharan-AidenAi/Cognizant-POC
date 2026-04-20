"""Generate short chat titles with Gemini (Vertex)."""

from __future__ import annotations

import logging
import re

from google import genai

from config import settings

logger = logging.getLogger(__name__)


def generate_chat_title(user_message: str, assistant_reply: str) -> str:
    """Return a concise title (max ~8 words), no quotes."""
    user_message = (user_message or "").strip()
    assistant_reply = (assistant_reply or "").strip()
    if not user_message:
        return "New chat"

    client = genai.Client(
        vertexai=True,
        project=settings.GCP_PROJECT_ID,
        location=settings.VERTEX_AI_LOCATION,
    )
    prompt = f"""Create a very short conversation title for an analytics assistant chat.
Rules:
- Maximum 8 words
- No quotation marks, no trailing punctuation
- Describe the user's intent or topic, not the assistant
- Plain language

User question:
{user_message[:1200]}

Assistant reply (for context only, do not copy verbatim):
{assistant_reply[:800]}

Title:"""

    try:
        response = client.models.generate_content(
            model=settings.GEMINI_FLASH_MODEL,
            contents=prompt,
        )
        text = (response.text or "").strip()
    except Exception as exc:
        logger.warning("Title generation failed: %s", exc)
        text = ""

    if not text:
        return _fallback_title(user_message)

    text = re.sub(r'^["\']|["\']$', "", text)
    text = re.sub(r"\s+", " ", text).strip()
    if len(text) > 80:
        text = text[:77] + "..."
    return text or _fallback_title(user_message)


def _fallback_title(user_message: str) -> str:
    words = user_message.split()
    if len(words) <= 8:
        return user_message[:80]
    return " ".join(words[:8]) + "…"
