-- Materialised view: Revenue forecast data — prepared for ML.FORECAST consumption
CREATE OR REPLACE VIEW `{project}.analytics_aggregates.mv_forecast_revenue` AS
SELECT
  region,
  DATE_TRUNC(transaction_date, MONTH) AS forecast_date,
  SUM(revenue) AS revenue,
  COUNT(DISTINCT seller_id) AS active_sellers,
  COUNT(DISTINCT transaction_id) AS transaction_count,
  AVG(revenue) AS avg_transaction_value
FROM `{project}.raw_data.transactions`
GROUP BY
  region,
  DATE_TRUNC(transaction_date, MONTH)
ORDER BY
  region,
  forecast_date;
