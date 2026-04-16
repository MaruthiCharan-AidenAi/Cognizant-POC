-- pgvector schema for schema_metadata table
-- Stores table/column descriptions and Q&A pairs with vector embeddings
-- for semantic search

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS schema_metadata (
  id SERIAL PRIMARY KEY,
  table_name TEXT NOT NULL,
  column_name TEXT,               -- NULL for table-level descriptions
  description TEXT NOT NULL,
  qa_pair JSONB,                  -- {"question": "...", "answer": "..."} for example Q&A
  embedding vector(768)           -- text-embedding-004 produces 768-dim vectors
);

-- IVFFlat index for fast cosine similarity search
-- Adjust lists parameter based on data size (sqrt(n) is a good starting point)
CREATE INDEX IF NOT EXISTS idx_schema_metadata_embedding
  ON schema_metadata
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 10);

-- Text search index for fallback keyword search
CREATE INDEX IF NOT EXISTS idx_schema_metadata_description
  ON schema_metadata
  USING gin (to_tsvector('english', description));

-- Composite index for filtering by table
CREATE INDEX IF NOT EXISTS idx_schema_metadata_table
  ON schema_metadata (table_name);
