"""Mock data responses for /mock-data endpoint.

All data mimics the real DB schema (seller view columns, realistic values)
but is entirely synthetic — no real user records.
"""

from __future__ import annotations

from copy import deepcopy

MOCK_CHARTS: list[dict] = [
    # ── 1. BAR: Revenue QTD by pod ───────────────────────────────────────
    {
        "type": "bar",
        "title": "Revenue QTD by Pod",
        "x_key": "pod",
        "y_key": "revenue_qtd",
        "data": [
            {"pod": "Alpha Pod", "revenue_qtd": 182000},
            {"pod": "Beta Pod", "revenue_qtd": 145000},
            {"pod": "Gamma Pod", "revenue_qtd": 210000},
            {"pod": "Delta Pod", "revenue_qtd": 98000},
            {"pod": "Epsilon Pod", "revenue_qtd": 173000},
            {"pod": "Zeta Pod", "revenue_qtd": 230000},
        ],
    },
    # ── 2. LINE: Daily revenue trend (last 28 days) ───────────────────────
    {
        "type": "line",
        "title": "Daily Revenue Trend — Last 28 Days",
        "x_key": "date",
        "y_key": "revenue_yesterday",
        "data": [
            {"date": "2025-03-24", "revenue_yesterday": 12400},
            {"date": "2025-03-25", "revenue_yesterday": 13100},
            {"date": "2025-03-26", "revenue_yesterday": 11800},
            {"date": "2025-03-27", "revenue_yesterday": 14200},
            {"date": "2025-03-28", "revenue_yesterday": 15600},
            {"date": "2025-03-29", "revenue_yesterday": 9800},
            {"date": "2025-03-30", "revenue_yesterday": 10200},
            {"date": "2025-03-31", "revenue_yesterday": 16300},
            {"date": "2025-04-01", "revenue_yesterday": 17100},
            {"date": "2025-04-02", "revenue_yesterday": 15900},
            {"date": "2025-04-03", "revenue_yesterday": 18200},
            {"date": "2025-04-04", "revenue_yesterday": 19400},
            {"date": "2025-04-05", "revenue_yesterday": 12100},
            {"date": "2025-04-06", "revenue_yesterday": 11700},
            {"date": "2025-04-07", "revenue_yesterday": 20100},
            {"date": "2025-04-08", "revenue_yesterday": 21300},
            {"date": "2025-04-09", "revenue_yesterday": 19800},
            {"date": "2025-04-10", "revenue_yesterday": 22400},
            {"date": "2025-04-11", "revenue_yesterday": 23100},
            {"date": "2025-04-12", "revenue_yesterday": 13400},
            {"date": "2025-04-13", "revenue_yesterday": 12800},
        ],
    },
    # ── 3. AREA: Rolling QTD revenue by quarter ────────────────────────────
    {
        "type": "area",
        "title": "Rolling QTD Revenue by Quarter",
        "x_key": "year_quarter",
        "y_key": "rolling_qtd_revenue",
        "data": [
            {"year_quarter": "2024Q1", "rolling_qtd_revenue": 520000},
            {"year_quarter": "2024Q2", "rolling_qtd_revenue": 610000},
            {"year_quarter": "2024Q3", "rolling_qtd_revenue": 580000},
            {"year_quarter": "2024Q4", "rolling_qtd_revenue": 720000},
            {"year_quarter": "2025Q1", "rolling_qtd_revenue": 695000},
        ],
    },
    # ── 4. PIE: Sessions by status ─────────────────────────────────────────
    {
        "type": "pie",
        "title": "Sessions by Status",
        "x_key": "status",
        "y_key": "session_count",
        "data": [
            {"status": "Completed", "session_count": 1842},
            {"status": "Answered", "session_count": 934},
            {"status": "Meet", "session_count": 421},
            {"status": "No-Show", "session_count": 178},
            {"status": "Cancelled", "session_count": 95},
        ],
    },
    # ── 5. HORIZONTAL BAR: Points attainment % by program ─────────────────
    {
        "type": "horizontal_bar",
        "title": "Points Attainment % by Program",
        "x_key": "program",
        "y_key": "attainment_pct",
        "data": [
            {"program": "Google Ads Search", "attainment_pct": 87},
            {"program": "Google Ads Display", "attainment_pct": 74},
            {"program": "YouTube Ads", "attainment_pct": 91},
            {"program": "Smart Shopping", "attainment_pct": 63},
            {"program": "Performance Max", "attainment_pct": 102},
            {"program": "Demand Gen", "attainment_pct": 55},
            {"program": "App Campaigns", "attainment_pct": 78},
            {"program": "Discovery Ads", "attainment_pct": 69},
            {"program": "Local Campaigns", "attainment_pct": 83},
        ],
    },
    # ── 6. STACKED BAR: Revenue breakdown by market & source ──────────────
    {
        "type": "stacked_bar",
        "title": "Revenue by Market — QTD vs Forecast vs Target",
        "x_key": "market",
        "y_keys": ["revenue_qtd", "capped_revenue_eoq_forecast", "revenue_target"],
        "data": [
            {"market": "North India", "revenue_qtd": 145000, "capped_revenue_eoq_forecast": 180000, "revenue_target": 200000},
            {"market": "South India", "revenue_qtd": 132000, "capped_revenue_eoq_forecast": 155000, "revenue_target": 170000},
            {"market": "West India", "revenue_qtd": 178000, "capped_revenue_eoq_forecast": 210000, "revenue_target": 220000},
            {"market": "East India", "revenue_qtd": 89000, "capped_revenue_eoq_forecast": 115000, "revenue_target": 130000},
        ],
    },
    # ── 7. SCATTER: OSAT score vs Revenue QTD ─────────────────────────────
    {
        "type": "scatter",
        "title": "OSAT Score vs Revenue QTD (per Seller)",
        "x_key": "revenue_qtd",
        "y_key": "osat_score",
        "data": [
            {"seller_name": "Aarav Singh", "revenue_qtd": 24000, "osat_score": 4.2},
            {"seller_name": "Priya Nair", "revenue_qtd": 31000, "osat_score": 4.6},
            {"seller_name": "Rohan Mehta", "revenue_qtd": 18000, "osat_score": 3.8},
            {"seller_name": "Kavya Reddy", "revenue_qtd": 42000, "osat_score": 4.8},
            {"seller_name": "Dev Patel", "revenue_qtd": 15000, "osat_score": 3.5},
            {"seller_name": "Sana Khan", "revenue_qtd": 38000, "osat_score": 4.4},
            {"seller_name": "Arjun Iyer", "revenue_qtd": 27000, "osat_score": 4.1},
            {"seller_name": "Meera Joshi", "revenue_qtd": 51000, "osat_score": 4.9},
            {"seller_name": "Kiran Rao", "revenue_qtd": 12000, "osat_score": 3.2},
            {"seller_name": "Anjali Sharma", "revenue_qtd": 35000, "osat_score": 4.5},
        ],
    },
    # ── 8. COMPOSED: Revenue actual + attainment rate overlay ─────────────
    {
        "type": "composed",
        "title": "Revenue QTD vs Attainment Rate by Pod",
        "x_key": "pod",
        "y_key": "revenue_qtd",
        "y_key_2": "attainment_pct",
        "data": [
            {"pod": "Alpha Pod", "revenue_qtd": 182000, "attainment_pct": 91},
            {"pod": "Beta Pod", "revenue_qtd": 145000, "attainment_pct": 72},
            {"pod": "Gamma Pod", "revenue_qtd": 210000, "attainment_pct": 105},
            {"pod": "Delta Pod", "revenue_qtd": 98000, "attainment_pct": 49},
            {"pod": "Epsilon Pod", "revenue_qtd": 173000, "attainment_pct": 86},
            {"pod": "Zeta Pod", "revenue_qtd": 230000, "attainment_pct": 115},
        ],
    },
]

MOCK_SUMMARY = (
    "Here is a full demo of all supported chart types using synthetic data that "
    "mirrors the seller analytics schema. Each chart is clickable for drill-down."
)


_ROLE_SUMMARY: dict[str, str] = {
    "seller": (
        "Seller demo view: personal/team execution metrics with revenue, sessions, "
        "points, and attainment-focused visuals."
    ),
    "ops_lead": (
        "Ops Lead demo view: operational health across pods/programs with throughput, "
        "quality, and target progress coverage."
    ),
    "quality_analyst": (
        "Quality Analyst demo view: service quality and customer satisfaction trends "
        "with TCSAT-heavy chart emphasis."
    ),
    "data_contributor": (
        "Data Contributor demo view: broad cross-functional metrics for exploration "
        "across revenue, productivity, sessions, and quality."
    ),
    "sys_admin": (
        "System Admin demo view: full-system synthetic observability with complete "
        "chart coverage for validation and troubleshooting."
    ),
    "pex_team": (
        "PEX Team demo view: performance excellence focus with stronger attainment, "
        "target tracking, and benchmark-style visuals."
    ),
}

_ROLE_CHART_LAYOUTS: dict[str, list[dict]] = {
    "seller": [
        {"source_idx": 0, "title": "Revenue QTD by Pod"},
        {"source_idx": 1, "type": "line", "title": "Daily Revenue Trend"},
        {"source_idx": 4, "title": "Points Attainment % by Program"},
        {"source_idx": 7, "title": "Revenue vs Attainment by Pod"},
    ],
    "ops_lead": [
        {"source_idx": 5, "title": "Market Performance (QTD / Forecast / Target)"},
        {"source_idx": 3, "title": "Sessions by Final Status"},
        {"source_idx": 7, "type": "bar", "y_key": "attainment_pct", "title": "Attainment % by Pod"},
        {"source_idx": 1, "type": "area", "title": "Daily Revenue Momentum"},
    ],
    "quality_analyst": [
        {"source_idx": 6, "type": "scatter", "title": "OSAT vs Revenue QTD"},
        {"source_idx": 3, "type": "pie", "title": "Session Outcome Mix"},
        {"source_idx": 1, "type": "line", "y_key": "revenue_yesterday", "title": "Daily Trend (Quality Proxy)"},
        {"source_idx": 4, "type": "horizontal_bar", "y_key": "attainment_pct", "title": "Program Quality-Attainment %"},
    ],
    "data_contributor": [
        {"source_idx": 0, "title": "Revenue QTD by Pod"},
        {"source_idx": 5, "title": "Market Revenue Stack"},
        {"source_idx": 6, "title": "OSAT vs Revenue Scatter"},
        {"source_idx": 7, "title": "Revenue with Attainment Overlay"},
    ],
    "sys_admin": [
        {"source_idx": 0, "title": "Revenue by Pod"},
        {"source_idx": 1, "title": "Daily Revenue Trend"},
        {"source_idx": 3, "title": "Session Status Distribution"},
        {"source_idx": 4, "title": "Attainment by Program"},
        {"source_idx": 5, "title": "Market Stack"},
        {"source_idx": 6, "title": "OSAT vs Revenue"},
        {"source_idx": 7, "title": "Composed Revenue + Attainment"},
    ],
    "pex_team": [
        {"source_idx": 7, "title": "Pod Revenue vs Attainment"},
        {"source_idx": 4, "title": "Program Attainment %"},
        {"source_idx": 5, "title": "Target Tracking by Market"},
        {"source_idx": 0, "type": "horizontal_bar", "title": "Revenue Ranking by Pod"},
    ],
}


def _build_role_charts(role: str) -> list[dict]:
    """Create role-specific chart structures (chart types and axis keys)."""
    layout = _ROLE_CHART_LAYOUTS.get(role, _ROLE_CHART_LAYOUTS["seller"])
    result: list[dict] = []

    for item in layout:
        source = deepcopy(MOCK_CHARTS[item["source_idx"]])
        if item.get("type"):
            source["type"] = item["type"]
        if item.get("title"):
            source["title"] = item["title"]
        if item.get("x_key"):
            source["x_key"] = item["x_key"]
        if item.get("y_key"):
            source["y_key"] = item["y_key"]
            source.pop("y_keys", None)
        if item.get("y_keys"):
            source["y_keys"] = item["y_keys"]
            source.pop("y_key", None)
        if item.get("y_key_2"):
            source["y_key_2"] = item["y_key_2"]
        result.append(source)

    return result


def get_mock_payload(role: str) -> dict:
    """Return role-aware synthetic payload for /data."""
    return {
        "summary": _ROLE_SUMMARY.get(role, MOCK_SUMMARY),
        "charts": _build_role_charts(role),
    }
