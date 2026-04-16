from models.suggestions import build_suggestion_questions
from models.user_context import UserContext


def test_build_suggestion_questions_is_role_and_schema_aware() -> None:
    user_ctx = UserContext(
        email="seller@example.com",
        role="seller",
        region="India",
        view_name="v_seller_india",
    )

    suggestions = build_suggestion_questions(user_ctx)

    assert suggestions
    assert len(suggestions) <= 6
    assert any("revenue target" in suggestion.lower() for suggestion in suggestions)
    assert any("revenue trend" in suggestion.lower() for suggestion in suggestions)


def test_build_suggestion_questions_deduplicates_and_falls_back() -> None:
    user_ctx = UserContext(
        email="unknown@example.com",
        role="unknown_role",
        region="India",
        view_name="v_unknown_india",
    )

    suggestions = build_suggestion_questions(user_ctx)

    assert suggestions == []
