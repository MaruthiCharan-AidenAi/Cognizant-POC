-- user_access table: RBAC configuration for chatbot users
CREATE TABLE IF NOT EXISTS `{project}.raw_data.user_access` (
  email STRING NOT NULL,
  role STRING NOT NULL,         -- 'ops_lead', 'analyst', 'finance', 'admin'
  region STRING,                -- Primary region assignment
  data_scope JSON               -- {"region": "South"} or {"region": "*"} for admin
)
OPTIONS (
  description = 'Access control configuration mapping users to roles and data scopes for the analytics chatbot',
  labels = [("team", "analytics"), ("env", "production")]
);
