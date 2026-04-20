"""API models for chat sessions."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class SessionSummary(BaseModel):
    session_id: str
    title: str | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None
    user_message_count: int = 0


class SessionListResponse(BaseModel):
    sessions: list[SessionSummary]


class ChatMessageOut(BaseModel):
    message_id: str
    role: str
    content: str
    created_at: datetime | None = None


class SessionMessagesResponse(BaseModel):
    session_id: str
    messages: list[ChatMessageOut]


class SessionTitleUpdate(BaseModel):
    title: str = Field(..., min_length=1, max_length=512)


class SemanticSearchHit(BaseModel):
    session_id: str
    session_title: str | None = None
    message_id: str
    role: str
    content: str
    created_at: datetime | None = None


class SemanticSearchResponse(BaseModel):
    hits: list[SemanticSearchHit]
