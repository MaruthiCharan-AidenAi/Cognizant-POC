-- ═══════════════════════════════════════════════════════════════════════
-- POC BigQuery Setup — run these in the BigQuery Console
-- Replace {project} with your actual GCP project ID
-- ═══════════════════════════════════════════════════════════════════════

-- 1. Create dataset
CREATE SCHEMA IF NOT EXISTS `{project}.rbac_demo`;

-- 2. Access control table
CREATE TABLE IF NOT EXISTS `{project}.rbac_demo.user_access` (
  email STRING,
  role STRING,
  region STRING
);

-- 3. Sample users (adjust emails to match your Google accounts)
INSERT INTO `{project}.rbac_demo.user_access` VALUES
  ('marketing_us@company.com', 'marketing', 'United States'),
  ('marketing_br@company.com', 'marketing', 'Brasil'),
  ('finance_us@company.com',   'finance',   'United States'),
  ('finance_br@company.com',   'finance',   'Brasil'),
  ('analyst_us@company.com',   'analyst',   'United States'),
  ('analyst_br@company.com',   'analyst',   'Brasil');

-- ═══════════════════════════════════════════════════════════════════════
-- MARKETING VIEWS
-- ═══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE VIEW `{project}.rbac_demo.v_marketing_us` AS
SELECT
  o.order_id,
  u.country,
  u.traffic_source,
  o.created_at
FROM `bigquery-public-data.thelook_ecommerce.orders` o
JOIN `bigquery-public-data.thelook_ecommerce.users` u
  ON o.user_id = u.id
WHERE u.country = 'United States';

CREATE OR REPLACE VIEW `{project}.rbac_demo.v_marketing_brasil` AS
SELECT
  o.order_id,
  u.country,
  u.traffic_source,
  o.created_at
FROM `bigquery-public-data.thelook_ecommerce.orders` o
JOIN `bigquery-public-data.thelook_ecommerce.users` u
  ON o.user_id = u.id
WHERE u.country = 'Brasil';

-- ═══════════════════════════════════════════════════════════════════════
-- FINANCE VIEWS
-- ═══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE VIEW `{project}.rbac_demo.v_finance_us` AS
SELECT
  o.order_id,
  u.country,
  oi.sale_price,
  o.created_at
FROM `bigquery-public-data.thelook_ecommerce.orders` o
JOIN `bigquery-public-data.thelook_ecommerce.users` u
  ON o.user_id = u.id
JOIN `bigquery-public-data.thelook_ecommerce.order_items` oi
  ON o.order_id = oi.order_id
WHERE u.country = 'United States';

CREATE OR REPLACE VIEW `{project}.rbac_demo.v_finance_brasil` AS
SELECT
  o.order_id,
  u.country,
  oi.sale_price,
  o.created_at
FROM `bigquery-public-data.thelook_ecommerce.orders` o
JOIN `bigquery-public-data.thelook_ecommerce.users` u
  ON o.user_id = u.id
JOIN `bigquery-public-data.thelook_ecommerce.order_items` oi
  ON o.order_id = oi.order_id
WHERE u.country = 'Brasil';

-- ═══════════════════════════════════════════════════════════════════════
-- ANALYST VIEWS (AGGREGATED)
-- ═══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE VIEW `{project}.rbac_demo.v_analyst_us` AS
SELECT
  u.country,
  DATE(o.created_at) AS order_date,
  COUNT(DISTINCT o.order_id) AS total_orders,
  SUM(oi.sale_price) AS total_revenue
FROM `bigquery-public-data.thelook_ecommerce.orders` o
JOIN `bigquery-public-data.thelook_ecommerce.users` u
  ON o.user_id = u.id
JOIN `bigquery-public-data.thelook_ecommerce.order_items` oi
  ON o.order_id = oi.order_id
WHERE u.country = 'United States'
GROUP BY u.country, order_date;

CREATE OR REPLACE VIEW `{project}.rbac_demo.v_analyst_brasil` AS
SELECT
  u.country,
  DATE(o.created_at) AS order_date,
  COUNT(DISTINCT o.order_id) AS total_orders,
  SUM(oi.sale_price) AS total_revenue
FROM `bigquery-public-data.thelook_ecommerce.orders` o
JOIN `bigquery-public-data.thelook_ecommerce.users` u
  ON o.user_id = u.id
JOIN `bigquery-public-data.thelook_ecommerce.order_items` oi
  ON o.order_id = oi.order_id
WHERE u.country = 'Brasil'
GROUP BY u.country, order_date;
