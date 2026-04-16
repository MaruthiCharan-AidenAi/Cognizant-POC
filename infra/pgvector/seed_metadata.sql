-- Seed metadata: table and column descriptions + Q&A pairs
-- Embeddings will be generated at runtime via text-embedding-004
-- This file populates the text fields; a separate script embeds them

-- ═══════════════════════════════════════════════════════════════════════
-- TABLE-LEVEL DESCRIPTIONS
-- ═══════════════════════════════════════════════════════════════════════

INSERT INTO schema_metadata (table_name, column_name, description, qa_pair) VALUES
('transactions', NULL,
 'Core transactional table containing all seller transactions. Partitioned by transaction_date and clustered by seller_id, region, and category. Each row represents a single transaction with revenue in INR (₹).',
 NULL),

('sellers', NULL,
 'Seller master data table. Contains seller profiles including tier classification (Gold/Silver/Bronze), regional assignment, contact details, and onboarding date.',
 NULL),

('reward_events', NULL,
 'Reward programme events table. Tracks all points-related activities including earn, redeem, expire, and adjustment events for sellers across tiers.',
 NULL),

('user_access', NULL,
 'RBAC configuration table for chatbot users. Maps email addresses to roles (ops_lead, analyst, finance, admin) and defines data scopes as JSON.',
 NULL),

-- ═══════════════════════════════════════════════════════════════════════
-- COLUMN-LEVEL DESCRIPTIONS — transactions
-- ═══════════════════════════════════════════════════════════════════════

('transactions', 'transaction_id',
 'Unique identifier for each transaction. STRING type, primary key equivalent.',
 NULL),

('transactions', 'seller_id',
 'Reference to the seller who initiated the transaction. Links to sellers.seller_id.',
 NULL),

('transactions', 'seller_tier',
 'Seller tier classification at time of transaction: Gold, Silver, or Bronze. Denormalised from sellers table for query performance.',
 NULL),

('transactions', 'region',
 'Geographic region of the transaction: South, North, East, or West. Used as the primary scope filter for RBAC.',
 NULL),

('transactions', 'category',
 'Product or service category of the transaction. Used for category-level revenue breakdown.',
 NULL),

('transactions', 'revenue',
 'Transaction revenue amount in Indian Rupees (₹). FLOAT64 type. This is the primary metric for most analytics queries.',
 NULL),

('transactions', 'transaction_date',
 'Date when the transaction occurred. DATE type. The table is partitioned on this column for cost-efficient filtering.',
 NULL),

('transactions', 'month',
 'Year-month string in YYYY-MM format for easy monthly aggregation filtering. Derived from transaction_date.',
 NULL),

-- ═══════════════════════════════════════════════════════════════════════
-- COLUMN-LEVEL DESCRIPTIONS — sellers
-- ═══════════════════════════════════════════════════════════════════════

('sellers', 'seller_id',
 'Unique seller identifier. Primary key. Referenced by transactions.seller_id.',
 NULL),

('sellers', 'seller_name',
 'Display name of the seller or business entity.',
 NULL),

('sellers', 'seller_tier',
 'Current tier: Gold (top performers), Silver (mid-tier), Bronze (entry-level). Tiers may change quarterly based on performance.',
 NULL),

('sellers', 'region',
 'Assigned region: South, North, East, or West. Determines regional analytics scope.',
 NULL),

('sellers', 'onboarded_date',
 'Date when the seller was onboarded to the platform. Used for cohort analysis and tenure calculations.',
 NULL),

-- ═══════════════════════════════════════════════════════════════════════
-- COLUMN-LEVEL DESCRIPTIONS — reward_events
-- ═══════════════════════════════════════════════════════════════════════

('reward_events', 'event_type',
 'Type of reward event: earn (points awarded), redeem (points used), expire (points expired), adjustment (manual correction).',
 NULL),

('reward_events', 'points',
 'Number of reward points involved in the event. Positive for earn, negative for redeem/expire.',
 NULL),

('reward_events', 'points_value',
 'Monetary value of the points in INR (₹). Conversion rate applied at event time.',
 NULL),

-- ═══════════════════════════════════════════════════════════════════════
-- MATERIALISED VIEWS DESCRIPTIONS
-- ═══════════════════════════════════════════════════════════════════════

('mv_weekly_revenue_by_seller', NULL,
 'Pre-aggregated weekly revenue by seller. Includes total, average, min, max revenue and transaction count per seller per week.',
 NULL),

('mv_monthly_revenue_by_region', NULL,
 'Pre-aggregated monthly revenue by region. Breaks down revenue by seller tier (Gold/Silver/Bronze) and includes active seller counts.',
 NULL),

('mv_quarterly_rewards_by_tier', NULL,
 'Pre-aggregated quarterly reward events by seller tier and event type. Shows points earned, redeemed, expired by tier per quarter.',
 NULL),

('mv_monthly_kpi_summary', NULL,
 'Comprehensive monthly KPI summary joining transaction and reward metrics. Includes revenue per seller, revenue per transaction, and all reward metrics.',
 NULL),

('mv_seller_cohort_monthly', NULL,
 'Seller cohort analysis showing monthly retention and revenue by onboarding cohort. Tracks months since onboarding for each cohort.',
 NULL),

('mv_forecast_revenue', NULL,
 'Revenue data prepared for ARIMA forecasting. Monthly revenue by region with active seller and transaction counts.',
 NULL);

-- ═══════════════════════════════════════════════════════════════════════
-- EXAMPLE Q&A PAIRS — for few-shot learning by the agents
-- ═══════════════════════════════════════════════════════════════════════

INSERT INTO schema_metadata (table_name, column_name, description, qa_pair) VALUES
('transactions', NULL,
 'Q&A: Total revenue by region for a specific month',
 '{"question": "What was the total revenue by region in November 2024?", "answer": "SELECT region, SUM(revenue) AS total_revenue FROM transactions WHERE month = ''2024-11'' GROUP BY region ORDER BY total_revenue DESC"}'::jsonb),

('transactions', NULL,
 'Q&A: Top sellers by revenue',
 '{"question": "Who are the top 10 sellers by revenue this quarter?", "answer": "SELECT t.seller_id, s.seller_name, s.seller_tier, SUM(t.revenue) AS total_revenue FROM transactions t JOIN sellers s ON t.seller_id = s.seller_id WHERE t.transaction_date >= DATE_TRUNC(CURRENT_DATE(), QUARTER) GROUP BY 1,2,3 ORDER BY total_revenue DESC LIMIT 10"}'::jsonb),

('transactions', NULL,
 'Q&A: Revenue comparison between periods',
 '{"question": "How does South region revenue this month compare to last month?", "answer": "WITH current AS (SELECT SUM(revenue) AS rev FROM transactions WHERE region = ''South'' AND month = FORMAT_DATE(''%Y-%m'', CURRENT_DATE())), prior AS (SELECT SUM(revenue) AS rev FROM transactions WHERE region = ''South'' AND month = FORMAT_DATE(''%Y-%m'', DATE_SUB(CURRENT_DATE(), INTERVAL 1 MONTH))) SELECT c.rev AS current_revenue, p.rev AS prior_revenue, c.rev - p.rev AS delta, SAFE_DIVIDE(c.rev - p.rev, p.rev) * 100 AS pct_change FROM current c, prior p"}'::jsonb),

('transactions', NULL,
 'Q&A: Revenue breakdown by seller tier',
 '{"question": "What is the revenue split by Gold, Silver, and Bronze sellers?", "answer": "SELECT seller_tier, COUNT(DISTINCT seller_id) AS sellers, SUM(revenue) AS total_revenue, AVG(revenue) AS avg_revenue FROM transactions WHERE transaction_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY) GROUP BY seller_tier ORDER BY total_revenue DESC"}'::jsonb),

('transactions', NULL,
 'Q&A: Root cause analysis for revenue drop',
 '{"question": "Why did revenue drop in the South region last month?", "answer": "WITH current AS (SELECT region, seller_tier, category, SUM(revenue) AS rev FROM transactions WHERE month = FORMAT_DATE(''%Y-%m'', DATE_SUB(CURRENT_DATE(), INTERVAL 1 MONTH)) AND region = ''South'' GROUP BY 1,2,3), prior AS (SELECT region, seller_tier, category, SUM(revenue) AS rev FROM transactions WHERE month = FORMAT_DATE(''%Y-%m'', DATE_SUB(CURRENT_DATE(), INTERVAL 2 MONTH)) AND region = ''South'' GROUP BY 1,2,3) SELECT COALESCE(c.seller_tier, p.seller_tier) AS seller_tier, COALESCE(c.category, p.category) AS category, COALESCE(c.rev,0) AS current_rev, COALESCE(p.rev,0) AS prior_rev, COALESCE(c.rev,0) - COALESCE(p.rev,0) AS delta FROM current c FULL OUTER JOIN prior p ON c.seller_tier = p.seller_tier AND c.category = p.category ORDER BY ABS(delta) DESC"}'::jsonb),

('mv_monthly_revenue_by_region', NULL,
 'Q&A: Monthly revenue trend by region',
 '{"question": "Show me the monthly revenue trend for all regions over the last 6 months", "answer": "SELECT month, region, total_revenue, active_sellers FROM mv_monthly_revenue_by_region WHERE month_start >= DATE_SUB(CURRENT_DATE(), INTERVAL 6 MONTH) ORDER BY region, month"}'::jsonb),

('mv_quarterly_rewards_by_tier', NULL,
 'Q&A: Rewards programme performance',
 '{"question": "How is the rewards programme performing for Gold sellers this quarter?", "answer": "SELECT quarter, event_type, total_points, total_points_value, distinct_sellers FROM mv_quarterly_rewards_by_tier WHERE seller_tier = ''Gold'' AND year = EXTRACT(YEAR FROM CURRENT_DATE()) ORDER BY quarter DESC, event_type"}'::jsonb),

('mv_seller_cohort_monthly', NULL,
 'Q&A: Seller retention analysis',
 '{"question": "What is the retention rate for sellers onboarded 6 months ago?", "answer": "SELECT cohort_month, months_since_onboard, cohort_sellers, total_revenue FROM mv_seller_cohort_monthly WHERE months_since_onboard BETWEEN 0 AND 6 AND cohort_month = DATE_TRUNC(DATE_SUB(CURRENT_DATE(), INTERVAL 6 MONTH), MONTH) ORDER BY months_since_onboard"}'::jsonb),

('mv_monthly_kpi_summary', NULL,
 'Q&A: KPI dashboard summary',
 '{"question": "Give me the KPI summary for last month", "answer": "SELECT * FROM mv_monthly_kpi_summary WHERE month = FORMAT_DATE(''%Y-%m'', DATE_SUB(CURRENT_DATE(), INTERVAL 1 MONTH)) ORDER BY region"}'::jsonb),

('transactions', NULL,
 'Q&A: Week-over-week revenue trend',
 '{"question": "Show week-over-week revenue trend for the South region", "answer": "SELECT DATE_TRUNC(transaction_date, WEEK(MONDAY)) AS week, SUM(revenue) AS weekly_revenue, LAG(SUM(revenue)) OVER (ORDER BY DATE_TRUNC(transaction_date, WEEK(MONDAY))) AS prev_week_revenue, SUM(revenue) - LAG(SUM(revenue)) OVER (ORDER BY DATE_TRUNC(transaction_date, WEEK(MONDAY))) AS wow_delta FROM transactions WHERE region = ''South'' AND transaction_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 90 DAY) GROUP BY week ORDER BY week"}'::jsonb);
