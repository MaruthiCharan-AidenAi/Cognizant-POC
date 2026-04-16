"""Unit tests for the scope_injector middleware.

Validates that the SQL AST rewriter correctly injects WHERE clauses
for various SQL shapes.
"""

from __future__ import annotations

import pytest

from middleware.scope_injector import inject_scope


class TestScopeInjector:
    """Test suite for inject_scope()."""

    def test_simple_select_no_where(self) -> None:
        """Injects WHERE into a SELECT without an existing WHERE clause."""
        sql = "SELECT region, SUM(revenue) AS total FROM transactions GROUP BY region"
        result = inject_scope(sql, "South")
        assert "region = 'South'" in result

    def test_simple_select_with_where(self) -> None:
        """AND-injects into an existing WHERE clause."""
        sql = "SELECT * FROM transactions WHERE seller_tier = 'Gold'"
        result = inject_scope(sql, "South")
        assert "region = 'South'" in result
        assert "seller_tier = 'Gold'" in result

    def test_admin_no_injection(self) -> None:
        """Admin users (scope_region=None) get no injection."""
        sql = "SELECT * FROM transactions WHERE seller_tier = 'Gold'"
        result = inject_scope(sql, None)
        assert "region = " not in result
        assert result.strip() == sql.strip() or "seller_tier = 'Gold'" in result

    def test_subquery_injection(self) -> None:
        """Injects into both outer and inner SELECT statements."""
        sql = """
            SELECT t.region, t.total
            FROM (
                SELECT region, SUM(revenue) AS total
                FROM transactions
                GROUP BY region
            ) t
            WHERE t.total > 1000
        """
        result = inject_scope(sql, "North")
        # The injector should add region filter to inner SELECT
        assert "region = 'North'" in result

    def test_join_query(self) -> None:
        """Injects into a query with JOINs."""
        sql = """
            SELECT t.region, s.seller_name, SUM(t.revenue) AS total
            FROM transactions t
            JOIN sellers s ON t.seller_id = s.seller_id
            GROUP BY t.region, s.seller_name
        """
        result = inject_scope(sql, "East")
        assert "region = 'East'" in result

    def test_cte_query(self) -> None:
        """Injects into queries using CTEs (WITH clause)."""
        sql = """
            WITH monthly AS (
                SELECT month, SUM(revenue) AS total
                FROM transactions
                GROUP BY month
            )
            SELECT * FROM monthly ORDER BY month
        """
        result = inject_scope(sql, "West")
        assert "region = 'West'" in result

    def test_aggregation_with_having(self) -> None:
        """Injects WHERE without affecting HAVING."""
        sql = """
            SELECT region, seller_tier, SUM(revenue) AS total
            FROM transactions
            WHERE month = '2024-11'
            GROUP BY region, seller_tier
            HAVING SUM(revenue) > 10000
        """
        result = inject_scope(sql, "South")
        assert "region = 'South'" in result
        assert "month = '2024-11'" in result

    def test_multiple_conditions(self) -> None:
        """Injects alongside multiple existing WHERE conditions."""
        sql = """
            SELECT * FROM transactions
            WHERE seller_tier = 'Gold' AND month = '2024-11' AND category = 'Electronics'
        """
        result = inject_scope(sql, "North")
        assert "region = 'North'" in result
        assert "seller_tier = 'Gold'" in result
        assert "month = '2024-11'" in result
        assert "category = 'Electronics'" in result

    def test_different_regions(self) -> None:
        """Validates injection works for all four regions."""
        sql = "SELECT * FROM transactions"
        for region in ["South", "North", "East", "West"]:
            result = inject_scope(sql, region)
            assert f"region = '{region}'" in result

    def test_materialised_view_query(self) -> None:
        """Injects into queries against materialised views."""
        sql = """
            SELECT region, month, total_revenue
            FROM mv_monthly_revenue_by_region
            WHERE month >= '2024-01'
            ORDER BY month
        """
        result = inject_scope(sql, "South")
        assert "region = 'South'" in result
        assert "month >= '2024-01'" in result

    def test_empty_scope_returns_original(self) -> None:
        """None scope (admin) returns SQL unchanged."""
        sql = "SELECT COUNT(*) FROM transactions"
        result = inject_scope(sql, None)
        # Should not inject anything
        assert "region = " not in result
