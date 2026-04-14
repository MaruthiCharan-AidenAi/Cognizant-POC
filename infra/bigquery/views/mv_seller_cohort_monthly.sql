-- Materialised view: Seller cohort analysis — monthly cohort retention
CREATE OR REPLACE VIEW `{project}.analytics_aggregates.mv_seller_cohort_monthly` AS
WITH seller_first_txn AS (
  SELECT
    seller_id,
    seller_tier,
    region,
    DATE_TRUNC(MIN(transaction_date), MONTH) AS cohort_month
  FROM `{project}.raw_data.transactions`
  GROUP BY seller_id, seller_tier, region
),
seller_monthly_activity AS (
  SELECT
    seller_id,
    DATE_TRUNC(transaction_date, MONTH) AS activity_month,
    COUNT(DISTINCT transaction_id) AS monthly_transactions,
    SUM(revenue) AS monthly_revenue
  FROM `{project}.raw_data.transactions`
  GROUP BY seller_id, DATE_TRUNC(transaction_date, MONTH)
)
SELECT
  c.cohort_month,
  c.seller_tier,
  c.region,
  a.activity_month,
  DATE_DIFF(a.activity_month, c.cohort_month, MONTH) AS months_since_onboard,
  COUNT(DISTINCT c.seller_id) AS cohort_sellers,
  SUM(a.monthly_transactions) AS total_transactions,
  SUM(a.monthly_revenue) AS total_revenue,
  AVG(a.monthly_revenue) AS avg_revenue_per_seller
FROM seller_first_txn c
JOIN seller_monthly_activity a
  ON c.seller_id = a.seller_id
GROUP BY
  c.cohort_month,
  c.seller_tier,
  c.region,
  a.activity_month,
  DATE_DIFF(a.activity_month, c.cohort_month, MONTH);
