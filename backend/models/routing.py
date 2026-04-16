"""Pydantic model for the router agent output."""

from __future__ import annotations

from pydantic import BaseModel, Field


class RouterOutput(BaseModel):
    """Structured output from the router agent.

    The router classifies the user question into an intent and selects the
    downstream agent to handle it.
    """

    intent: str = Field(
        ...,
        description="Classified intent: rca | sql | trends | conversational",
    )
    time_range: dict[str, str] = Field(
        default_factory=lambda: {"start": "", "end": ""},
        description="Resolved time range as {start: YYYY-MM-DD, end: YYYY-MM-DD}",
    )
    dimensions: list[str] = Field(
        default_factory=list,
        description="Relevant dimensions (e.g. region, seller_tier)",
    )
    agent: str = Field(
        ...,
        description="Target agent name: rca_agent | sql_analytics_agent | trends_agent | conversational_agent",
    )
    confidence: float = Field(
        default=0.5,
        ge=0.0,
        le=1.0,
        description="Router confidence 0-1",
    )
