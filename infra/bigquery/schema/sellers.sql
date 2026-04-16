-- sellers table: seller master data
CREATE TABLE IF NOT EXISTS `{project}.raw_data.sellers` (
  seller_id STRING NOT NULL,
  seller_name STRING,
  seller_tier STRING,           -- 'Gold', 'Silver', 'Bronze'
  region STRING,                -- 'South', 'North', 'East', 'West'
  email STRING,
  phone STRING,                 -- PII — apply policy tag in column security
  onboarded_date DATE
)
OPTIONS (
  description = 'Seller master data including tier classification and region assignment',
  labels = [("team", "analytics"), ("env", "production")]
);
