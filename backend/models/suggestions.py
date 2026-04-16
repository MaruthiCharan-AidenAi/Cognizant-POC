"""Role-aware suggestion generation derived from view schemas."""

from __future__ import annotations

from pydantic import BaseModel, Field

from models.user_context import UserContext


class SuggestionResponse(BaseModel):
    """Authenticated suggestion payload returned to the frontend."""

    role: str
    region: str
    suggestions: list[str] = Field(default_factory=list)


def _has_columns(user_ctx: UserContext, *columns: str) -> bool:
    available = set(user_ctx.column_names)
    return all(column in available for column in columns)


def build_suggestion_questions(user_ctx: UserContext) -> list[str]:
    """Create role-aware starter questions from the authorized schema."""

    suggestions: list[str] = []

    if _has_columns(user_ctx, "revenue_qtd", "revenue_target"):
        suggestions.extend(
            [
                "Which companies are furthest below their revenue target this quarter?",
                "Show actual revenue vs target by pod for the current quarter.",
            ]
        )

    if _has_columns(user_ctx, "capped_revenue_eoq_forecast", "revenue_target"):
        suggestions.append(
            "Which pods are forecasted to miss their end-of-quarter revenue target?"
        )

    if _has_columns(user_ctx, "points_won", "points_target_eoq"):
        suggestions.append(
            "Which teams have the biggest gap between points won and points target?"
        )

    if _has_columns(user_ctx, "is_uaa", "uaa_target_eoq"):
        suggestions.append(
            "How is UAA attainment tracking against target across programs?"
        )

    if _has_columns(user_ctx, "total_sessions", "completed_sessions"):
        suggestions.append(
            "Which pods have the lowest session completion rate right now?"
        )

    if _has_columns(user_ctx, "talk_time_seconds", "completed_phone_calls"):
        suggestions.append(
            "Which sellers have unusually high talk time but low completed phone calls?"
        )

    if _has_columns(user_ctx, "osat_score", "rsat_score", "psat_score"):
        suggestions.append(
            "Which pods have the lowest customer satisfaction scores this quarter?"
        )

    if _has_columns(user_ctx, "tcsat_response_date", "osat_score"):
        suggestions.append(
            "Show the customer satisfaction trend over time for my authorized data."
        )

    if _has_columns(user_ctx, "tenure_months", "people_status"):
        suggestions.append(
            "How does performance vary by employee tenure and status?"
        )

    if _has_columns(user_ctx, "program", "market", "revenue_qtd"):
        suggestions.append(
            "Which programs or markets are driving the strongest revenue results?"
        )

    if _has_columns(user_ctx, "is_pitched", "is_adopted"):
        suggestions.append(
            "Where is adoption lagging after accounts are pitched?"
        )

    if _has_columns(user_ctx, "year_quarter", "revenue_qtd"):
        suggestions.append(
            "What is the revenue trend by quarter, and where did momentum change?"
        )

    role_fallbacks: dict[str, list[str]] = {
        "seller": [
            "Which accounts should I focus on first to improve revenue attainment this quarter?",
            "Show my strongest and weakest companies by revenue contribution.",
        ],
        "ops_lead": [
            "Which pods need attention across revenue, productivity, and session completion?",
            "Who on the team is off-track against target this quarter?",
        ],
        "quality_analyst": [
            "Which programs have the biggest satisfaction quality issues right now?",
            "Where are the lowest OSAT, RSAT, or PSAT scores concentrated?",
        ],
        "data_contributor": [
            "Give me a broad performance summary across revenue, targets, and satisfaction.",
            "Which segments stand out as overperforming or underperforming right now?",
        ],
        "sys_admin": [
            "Which regions or programs show the largest target attainment gaps?",
            "Where are the biggest operational risks across the full authorized view?",
        ],
        "pex_team": [
            "Which areas are most underperforming versus expectations this quarter?",
            "Show a benchmark view of target attainment across teams and programs.",
        ],
    }

    suggestions.extend(role_fallbacks.get(user_ctx.role, []))

    # Preserve order while removing duplicates and trimming the payload for the UI.
    deduped: list[str] = []
    seen: set[str] = set()
    for suggestion in suggestions:
        cleaned = suggestion.strip()
        if cleaned and cleaned not in seen:
            deduped.append(cleaned)
            seen.add(cleaned)

    return deduped[:6]
