-- ARIMA+ model: UAA (Unique Active Accounts) forecast by seller segment
-- Tracks active seller counts over time segmented by tier
CREATE OR REPLACE MODEL `{project}.analytics_aggregates.arima_uaa_by_segment`
OPTIONS (
  MODEL_TYPE = 'ARIMA_PLUS',
  TIME_SERIES_TIMESTAMP_COL = 'month_date',
  TIME_SERIES_DATA_COL = 'active_sellers',
  TIME_SERIES_ID_COL = 'seller_tier',
  AUTO_ARIMA = TRUE,
  DATA_FREQUENCY = 'MONTHLY',
  HOLIDAY_REGION = 'IN',
  CLEAN_SPIKES_AND_DIPS = TRUE,
  ADJUST_STEP_CHANGES = TRUE,
  DECOMPOSE_TIME_SERIES = TRUE
) AS
SELECT
  seller_tier,
  DATE_TRUNC(transaction_date, MONTH) AS month_date,
  COUNT(DISTINCT seller_id) AS active_sellers
FROM `{project}.raw_data.transactions`
GROUP BY seller_tier, DATE_TRUNC(transaction_date, MONTH);
