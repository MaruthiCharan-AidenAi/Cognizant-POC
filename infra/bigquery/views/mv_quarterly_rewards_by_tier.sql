-- Materialised view: Quarterly rewards aggregated by tier
CREATE OR REPLACE VIEW `{project}.analytics_aggregates.mv_quarterly_rewards_by_tier` AS
SELECT
  seller_tier,
  region,
  EXTRACT(YEAR FROM event_date) AS year,
  EXTRACT(QUARTER FROM event_date) AS quarter,
  DATE_TRUNC(event_date, QUARTER) AS quarter_start,
  event_type,
  COUNT(*) AS event_count,
  SUM(points) AS total_points,
  SUM(points_value) AS total_points_value,
  COUNT(DISTINCT seller_id) AS distinct_sellers,
  AVG(points) AS avg_points_per_event,
  AVG(points_value) AS avg_value_per_event
FROM `{project}.raw_data.reward_events`
GROUP BY
  seller_tier,
  region,
  EXTRACT(YEAR FROM event_date),
  EXTRACT(QUARTER FROM event_date),
  DATE_TRUNC(event_date, QUARTER),
  event_type;
