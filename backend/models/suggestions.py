"""Role-aware suggestion generation derived from view schemas."""

from __future__ import annotations

from pydantic import BaseModel, Field

from models.user_context import UserContext


class SuggestionResponse(BaseModel):
    """Authenticated suggestion payload returned to the frontend."""

    role: str
    region: str
    suggestions: list[str] = Field(default_factory=list)


# ── Commented out: dynamic column-based suggestion logic (replaced by static role questions) ──
# def _has_columns(user_ctx: UserContext, *columns: str) -> bool:
#     available = set(user_ctx.column_names)
#     return all(column in available for column in columns)
#
# def build_suggestion_questions(user_ctx: UserContext) -> list[str]:
#     suggestions: list[str] = []
#
#     if _has_columns(user_ctx, "revenue_qtd", "revenue_target"):
#         suggestions.extend([
#             "Which companies are furthest below their revenue target this quarter?",
#             "Show actual revenue vs target by pod for the current quarter.",
#         ])
#     if _has_columns(user_ctx, "capped_revenue_eoq_forecast", "revenue_target"):
#         suggestions.append("Which pods are forecasted to miss their end-of-quarter revenue target?")
#     if _has_columns(user_ctx, "points_won", "points_target_eoq"):
#         suggestions.append("Which teams have the biggest gap between points won and points target?")
#     if _has_columns(user_ctx, "is_uaa", "uaa_target_eoq"):
#         suggestions.append("How is UAA attainment tracking against target across programs?")
#     if _has_columns(user_ctx, "total_sessions", "completed_sessions"):
#         suggestions.append("Which pods have the lowest session completion rate right now?")
#     if _has_columns(user_ctx, "talk_time_seconds", "completed_phone_calls"):
#         suggestions.append("Which sellers have unusually high talk time but low completed phone calls?")
#     if _has_columns(user_ctx, "osat_score", "rsat_score", "psat_score"):
#         suggestions.append("Which pods have the lowest customer satisfaction scores this quarter?")
#     if _has_columns(user_ctx, "tcsat_response_date", "osat_score"):
#         suggestions.append("Show the customer satisfaction trend over time for my authorized data.")
#     if _has_columns(user_ctx, "tenure_months", "people_status"):
#         suggestions.append("How does performance vary by employee tenure and status?")
#     if _has_columns(user_ctx, "program", "market", "revenue_qtd"):
#         suggestions.append("Which programs or markets are driving the strongest revenue results?")
#     if _has_columns(user_ctx, "is_pitched", "is_adopted"):
#         suggestions.append("Where is adoption lagging after accounts are pitched?")
#     if _has_columns(user_ctx, "year_quarter", "revenue_qtd"):
#         suggestions.append("What is the revenue trend by quarter, and where did momentum change?")
#
#     role_fallbacks: dict[str, list[str]] = {
#         "seller": [
#             "Which accounts should I focus on first to improve revenue attainment this quarter?",
#             "Show my strongest and weakest companies by revenue contribution.",
#         ],
#         "ops_lead": [
#             "Which pods need attention across revenue, productivity, and session completion?",
#             "Who on the team is off-track against target this quarter?",
#         ],
#         "quality_analyst": [
#             "Which programs have the biggest satisfaction quality issues right now?",
#             "Where are the lowest OSAT, RSAT, or PSAT scores concentrated?",
#         ],
#         "data_contributor": [
#             "Give me a broad performance summary across revenue, targets, and satisfaction.",
#             "Which segments stand out as overperforming or underperforming right now?",
#         ],
#         "sys_admin": [
#             "Which regions or programs show the largest target attainment gaps?",
#             "Where are the biggest operational risks across the full authorized view?",
#         ],
#         "pex_team": [
#             "Which areas are most underperforming versus expectations this quarter?",
#             "Show a benchmark view of target attainment across teams and programs.",
#         ],
#     }
#     suggestions.extend(role_fallbacks.get(user_ctx.role, []))
#
#     deduped: list[str] = []
#     seen: set[str] = set()
#     for suggestion in suggestions:
#         cleaned = suggestion.strip()
#         if cleaned and cleaned not in seen:
#             deduped.append(cleaned)
#             seen.add(cleaned)
#     return deduped[:6]


# Static role-based questions (4 per persona)
_ROLE_QUESTIONS: dict[str, list[str]] = {
    "seller": [
        "How is my revenue trending this quarter compared to last quarter?",
        "Which accounts are farthest from achieving their revenue targets?",
        "What is my pitch-to-adoption conversion rate across programs?",
        "What is the relationship between talk time and revenue?",
    ],
    "ops_lead": [
        "How is revenue distributed across different pods and programs?",
        "Which teams are performing above and below target?",
        "Which reps are consistently underperforming across metrics?",
        "How do satisfaction scores vary across teams and programs?",
    ],
    "quality_analyst": [
        "How do OSAT, RSAT, and PSAT scores trend over time?",
        "Which programs have the lowest satisfaction scores?",
        "How do session metrics correlate with satisfaction scores?",
        "Which programs show the biggest gap between activity and satisfaction?",
    ],
    "data_contributor": [
        "What are the key drivers of revenue growth across all dimensions?",
        "How do revenue, productivity, and session metrics interact?",
        "What anomalies exist in recent data trends?",
        "Which metrics are most strongly correlated with revenue?",
    ],
    "sys_admin": [
        "Are there inconsistencies between revenue and productivity data?",
        "Which records have missing or null critical fields?",
        "Are there anomalies in data volume across time?",
        "Are there gaps in data availability for any role?",
    ],
    "pex_team": [
        "How does actual performance compare to targets across teams?",
        "Which teams or programs are top performers?",
        "Where are the biggest inefficiencies in the funnel?",
        "What are the biggest drivers of success across the organization?",
    ],
}


def build_suggestion_questions(user_ctx: UserContext) -> list[str]:
    """Return 4 static role-based starter questions for the user's persona."""
    return _ROLE_QUESTIONS.get(user_ctx.role, [
        "How is overall performance trending this quarter?",
        "Which areas are most off-track against targets?",
        "Where are the biggest opportunities for improvement?",
        "What does the data say about current operational health?",
    ])
