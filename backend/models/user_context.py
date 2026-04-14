"""User context resolved from JWT + BigQuery user_access table."""

from __future__ import annotations

from dataclasses import dataclass


# ── View mapping — CORE RBAC ENFORCEMENT ────────────────────────────────
# Maps (role, region) → BigQuery view name.
# These views are pre-created and act as the data security layer.
VIEW_MAP: dict[tuple[str, str], str] = {
    ("marketing", "United States"): "v_marketing_us",
    ("marketing", "Brasil"): "v_marketing_brasil",
    ("finance", "United States"): "v_finance_us",
    ("finance", "Brasil"): "v_finance_brasil",
    ("analyst", "United States"): "v_analyst_us",
    ("analyst", "Brasil"): "v_analyst_brasil",
}

# ── Schema descriptions per role (for agent prompts) ───────────────────
VIEW_SCHEMAS: dict[str, dict] = {
    "marketing": {
        "description": "Marketing view — order-level data with traffic source attribution, filtered to the user's region.",
        "columns": [
            {"name": "order_id", "type": "INT64", "description": "Unique order identifier"},
            {"name": "country", "type": "STRING", "description": "Customer country"},
            {"name": "traffic_source", "type": "STRING", "description": "Marketing channel (Search, Organic, Facebook, Display, Email, YouTube)"},
            {"name": "created_at", "type": "TIMESTAMP", "description": "Order creation timestamp"},
        ],
    },
    "finance": {
        "description": "Finance view — order-level data with sale prices, filtered to the user's region.",
        "columns": [
            {"name": "order_id", "type": "INT64", "description": "Unique order identifier"},
            {"name": "country", "type": "STRING", "description": "Customer country"},
            {"name": "sale_price", "type": "FLOAT64", "description": "Item sale price in USD"},
            {"name": "created_at", "type": "TIMESTAMP", "description": "Order creation timestamp"},
        ],
    },
    "analyst": {
        "description": "Analyst view — daily aggregated order counts and revenue, filtered to the user's region.",
        "columns": [
            {"name": "country", "type": "STRING", "description": "Customer country"},
            {"name": "order_date", "type": "DATE", "description": "Date of order"},
            {"name": "total_orders", "type": "INT64", "description": "Count of distinct orders on that date"},
            {"name": "total_revenue", "type": "FLOAT64", "description": "Sum of sale prices in USD on that date"},
        ],
    },
}


@dataclass(frozen=True, slots=True)
class UserContext:
    """Immutable context resolved from JWT + user_access table.

    Attributes:
        email:      Authenticated Google email.
        role:       One of ``marketing``, ``finance``, ``analyst``.
        region:     Data region: ``United States`` or ``Brasil``.
        view_name:  The BigQuery view this user is authorized to query.
    """

    email: str
    role: str
    region: str
    view_name: str

    @property
    def schema_info(self) -> dict:
        """Return the schema description for this user's role."""
        return VIEW_SCHEMAS.get(self.role, {})

    @property
    def column_names(self) -> list[str]:
        """Return the column names available in this user's view."""
        schema = self.schema_info
        return [col["name"] for col in schema.get("columns", [])]

    @property
    def schema_prompt(self) -> str:
        """Build a schema description string for agent prompts."""
        schema = self.schema_info
        if not schema:
            return "No schema information available."
        lines = [f"View: {self.view_name}", f"Description: {schema['description']}", "Columns:"]
        for col in schema.get("columns", []):
            lines.append(f"  - {col['name']} ({col['type']}): {col['description']}")
        return "\n".join(lines)
