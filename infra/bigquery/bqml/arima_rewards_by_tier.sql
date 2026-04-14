-- ARIMA+ model: Rewards points forecast by seller tier
-- Tracks total points activity per tier over time
CREATE OR REPLACE MODEL `{project}.analytics_aggregates.arima_rewards_by_tier`
OPTIONS (
  MODEL_TYPE = 'ARIMA_PLUS',
  TIME_SERIES_TIMESTAMP_COL = 'month_date',
  TIME_SERIES_DATA_COL = 'total_points',
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
  DATE_TRUNC(event_date, MONTH) AS month_date,
  SUM(points) AS total_points
FROM `{project}.raw_data.reward_events`
WHERE event_type = 'earn'
GROUP BY seller_tier, DATE_TRUNC(event_date, MONTH);
