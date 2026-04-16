-- Materialised view: Monthly KPI summary — key business metrics rolled up
CREATE OR REPLACE VIEW `{project}.analytics_aggregates.mv_monthly_kpi_summary` AS
WITH txn_metrics AS (
  SELECT
    month,
    region,
    COUNT(DISTINCT transaction_id) AS total_transactions,
    COUNT(DISTINCT seller_id) AS active_sellers,
    SUM(revenue) AS total_revenue,
    AVG(revenue) AS avg_transaction_value,
    APPROX_QUANTILES(revenue, 100)[OFFSET(50)] AS median_transaction_value,
    COUNTIF(seller_tier = 'Gold') AS gold_count,
    COUNTIF(seller_tier = 'Silver') AS silver_count,
    COUNTIF(seller_tier = 'Bronze') AS bronze_count
  FROM `{project}.raw_data.transactions`
  GROUP BY month, region
),
reward_metrics AS (
  SELECT
    month,
    region,
    SUM(CASE WHEN event_type = 'earn' THEN points ELSE 0 END) AS points_earned,
    SUM(CASE WHEN event_type = 'redeem' THEN points ELSE 0 END) AS points_redeemed,
    SUM(CASE WHEN event_type = 'expire' THEN points ELSE 0 END) AS points_expired,
    SUM(points_value) AS total_reward_value
  FROM `{project}.raw_data.reward_events`
  GROUP BY month, region
)
SELECT
  t.month,
  t.region,
  t.total_transactions,
  t.active_sellers,
  t.total_revenue,
  t.avg_transaction_value,
  t.median_transaction_value,
  t.gold_count,
  t.silver_count,
  t.bronze_count,
  COALESCE(r.points_earned, 0) AS points_earned,
  COALESCE(r.points_redeemed, 0) AS points_redeemed,
  COALESCE(r.points_expired, 0) AS points_expired,
  COALESCE(r.total_reward_value, 0) AS total_reward_value,
  SAFE_DIVIDE(t.total_revenue, t.active_sellers) AS revenue_per_seller,
  SAFE_DIVIDE(t.total_revenue, t.total_transactions) AS revenue_per_transaction
FROM txn_metrics t
LEFT JOIN reward_metrics r
  ON t.month = r.month AND t.region = r.region;
