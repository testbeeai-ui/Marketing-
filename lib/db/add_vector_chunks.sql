-- Enable vector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Vector Chunks Table
CREATE TABLE IF NOT EXISTS vector_chunks (
    id TEXT PRIMARY KEY,
    user_id BIGINT REFERENCES user_profiles(user_id) ON DELETE CASCADE,
    block_id TEXT REFERENCES blocks(id) ON DELETE CASCADE,
    file_id TEXT REFERENCES documents(id) ON DELETE CASCADE,
    text TEXT,
    embedding vector(1536),
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_vector_chunks_embedding ON vector_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX IF NOT EXISTS idx_vector_chunks_block_id ON vector_chunks(block_id);
CREATE INDEX IF NOT EXISTS idx_vector_chunks_file_id ON vector_chunks(file_id);
CREATE INDEX IF NOT EXISTS idx_vector_chunks_user_id ON vector_chunks(user_id);

-- Match function for similarity search
CREATE OR REPLACE FUNCTION match_vector_chunks(
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  match_block_id text,
  match_user_id bigint DEFAULT NULL
)
RETURNS TABLE (
  id text,
  user_id bigint,
  block_id text,
  file_id text,
  text text,
  embedding vector(1536),
  metadata jsonb,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    vector_chunks.id,
    vector_chunks.user_id,
    vector_chunks.block_id,
    vector_chunks.file_id,
    vector_chunks.text,
    vector_chunks.embedding,
    vector_chunks.metadata,
    1 - (vector_chunks.embedding <=> query_embedding) as similarity
  FROM vector_chunks
  WHERE 1 - (vector_chunks.embedding <=> query_embedding) > match_threshold
  AND vector_chunks.block_id = match_block_id
  AND (match_user_id IS NULL OR vector_chunks.user_id = match_user_id)
  ORDER BY vector_chunks.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
