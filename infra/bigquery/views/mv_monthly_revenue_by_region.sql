-- Materialised view: Monthly revenue aggregated by region
CREATE OR REPLACE VIEW `{project}.analytics_aggregates.mv_monthly_revenue_by_region` AS
SELECT
  region,
  month,
  DATE_TRUNC(transaction_date, MONTH) AS month_start,
  COUNT(DISTINCT transaction_id) AS transaction_count,
  COUNT(DISTINCT seller_id) AS active_sellers,
  SUM(revenue) AS total_revenue,
  AVG(revenue) AS avg_transaction_revenue,
  COUNTIF(seller_tier = 'Gold') AS gold_transactions,
  COUNTIF(seller_tier = 'Silver') AS silver_transactions,
  COUNTIF(seller_tier = 'Bronze') AS bronze_transactions,
  SUM(CASE WHEN seller_tier = 'Gold' THEN revenue ELSE 0 END) AS gold_revenue,
  SUM(CASE WHEN seller_tier = 'Silver' THEN revenue ELSE 0 END) AS silver_revenue,
  SUM(CASE WHEN seller_tier = 'Bronze' THEN revenue ELSE 0 END) AS bronze_revenue
FROM `{project}.raw_data.transactions`
GROUP BY
  region,
  month,
  DATE_TRUNC(transaction_date, MONTH);
