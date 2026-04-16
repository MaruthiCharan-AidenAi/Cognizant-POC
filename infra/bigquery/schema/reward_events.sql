-- reward_events table: tracks all reward programme activities
CREATE TABLE IF NOT EXISTS `{project}.raw_data.reward_events` (
  event_id STRING NOT NULL,
  seller_id STRING NOT NULL,
  seller_tier STRING,           -- 'Gold', 'Silver', 'Bronze'
  region STRING,                -- 'South', 'North', 'East', 'West'
  event_type STRING,            -- 'earn', 'redeem', 'expire', 'adjustment'
  points INT64,
  points_value FLOAT64,         -- monetary value in ₹
  event_date DATE,
  month STRING,                 -- 'YYYY-MM' format
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
)
PARTITION BY event_date
CLUSTER BY seller_id, region, event_type
OPTIONS (
  description = 'Reward programme events tracking points earned, redeemed, expired, and adjusted',
  labels = [("team", "analytics"), ("env", "production")]
);
