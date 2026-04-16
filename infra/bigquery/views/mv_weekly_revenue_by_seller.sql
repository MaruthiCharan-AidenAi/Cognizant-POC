-- Materialised view: Weekly revenue aggregated by seller
CREATE OR REPLACE VIEW `{project}.analytics_aggregates.mv_weekly_revenue_by_seller` AS
SELECT
  seller_id,
  seller_tier,
  region,
  DATE_TRUNC(transaction_date, WEEK(MONDAY)) AS week_start,
  COUNT(DISTINCT transaction_id) AS transaction_count,
  SUM(revenue) AS total_revenue,
  AVG(revenue) AS avg_revenue,
  MIN(revenue) AS min_revenue,
  MAX(revenue) AS max_revenue,
  COUNT(DISTINCT category) AS distinct_categories
FROM `{project}.raw_data.transactions`
GROUP BY
  seller_id,
  seller_tier,
  region,
  DATE_TRUNC(transaction_date, WEEK(MONDAY));
