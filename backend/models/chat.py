"""Pydantic request / response models for the /chat endpoint."""

from __future__ import annotations

from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    """Incoming chat request body."""

    message: str = Field(..., min_length=1, max_length=4000, description="User question")
    session_id: str = Field(..., min_length=1, max_length=128, description="Client-generated session ID")


class SSETokenChunk(BaseModel):
    """Streamed token chunk."""
    type: str = "token"
    content: str


class SSEConfidenceChunk(BaseModel):
    """Streamed confidence metadata."""
    type: str = "confidence"
    score: int = Field(..., ge=0, le=100)
    level: str  # HIGH, MEDIUM, LOW


class SSEAssumptionChunk(BaseModel):
    """Streamed assumption notice."""
    type: str = "assumption"
    text: str


class SSEDoneChunk(BaseModel):
    """End-of-stream marker."""
    type: str = "done"


class ChatErrorResponse(BaseModel):
    """Error response body."""
    error: str
    detail: str = ""
    retry_after: int | None = None


def confidence_level(score: int) -> str:
    """Map a numeric score to a human-readable level."""
    if score >= 80:
        return "HIGH"
    if score >= 60:
        return "MEDIUM"
    return "LOW"
