-- transactions table: core transactional data
-- Partitioned by transaction_date, clustered by seller_id, region, category
CREATE TABLE IF NOT EXISTS `{project}.raw_data.transactions` (
  transaction_id STRING NOT NULL,
  seller_id STRING NOT NULL,
  seller_tier STRING,           -- 'Gold', 'Silver', 'Bronze'
  region STRING,                -- 'South', 'North', 'East', 'West'
  category STRING,
  revenue FLOAT64,
  transaction_date DATE,
  month STRING,                 -- 'YYYY-MM' format for easy filtering
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
)
PARTITION BY transaction_date
CLUSTER BY seller_id, region, category
OPTIONS (
  description = 'Core transaction records partitioned by date and clustered for analytics queries',
  labels = [("team", "analytics"), ("env", "production")]
);
