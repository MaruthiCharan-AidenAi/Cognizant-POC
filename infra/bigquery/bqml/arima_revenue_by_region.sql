-- ARIMA+ model: Revenue forecast by region
-- Uses monthly revenue data partitioned by region
CREATE OR REPLACE MODEL `{project}.analytics_aggregates.arima_revenue_by_region`
OPTIONS (
  MODEL_TYPE = 'ARIMA_PLUS',
  TIME_SERIES_TIMESTAMP_COL = 'forecast_date',
  TIME_SERIES_DATA_COL = 'revenue',
  TIME_SERIES_ID_COL = 'region',
  AUTO_ARIMA = TRUE,
  DATA_FREQUENCY = 'MONTHLY',
  HOLIDAY_REGION = 'IN',
  CLEAN_SPIKES_AND_DIPS = TRUE,
  ADJUST_STEP_CHANGES = TRUE,
  DECOMPOSE_TIME_SERIES = TRUE
) AS
SELECT
  region,
  DATE_TRUNC(transaction_date, MONTH) AS forecast_date,
  SUM(revenue) AS revenue
FROM `{project}.raw_data.transactions`
GROUP BY region, DATE_TRUNC(transaction_date, MONTH);
