-- Chat sessions and messages for the analytics chatbot.
-- Run in your GCP project (same dataset as BQ_DATASET, e.g. cognizant_poc).

CREATE TABLE IF NOT EXISTS `PROJECT.DATASET.chat_sessions` (
  session_id STRING NOT NULL,
  user_email STRING NOT NULL,
  title STRING,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL
)
CLUSTER BY user_email, session_id;

CREATE TABLE IF NOT EXISTS `PROJECT.DATASET.chat_messages` (
  message_id STRING NOT NULL,
  session_id STRING NOT NULL,
  user_email STRING NOT NULL,
  role STRING NOT NULL,
  content STRING NOT NULL,
  created_at TIMESTAMP NOT NULL,
  embedding_model STRING,
  vector_datapoint_id STRING
)
CLUSTER BY user_email, session_id;
