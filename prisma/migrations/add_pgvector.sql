-- Enable pgvector extension (requires superuser in Supabase)
-- This should be run manually in Supabase SQL Editor if not already enabled
CREATE EXTENSION IF NOT EXISTS vector;

-- Add embedding column to code_chunks table
-- voyage-code-3 uses 1024 dimensions
ALTER TABLE code_chunks ADD COLUMN IF NOT EXISTS embedding vector(1024);

-- Create IVFFlat index for fast similarity search
-- lists = sqrt(number_of_rows) is a good starting point
-- For small datasets, start with 100
CREATE INDEX IF NOT EXISTS code_chunks_embedding_idx
ON code_chunks
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Create function for similarity search
CREATE OR REPLACE FUNCTION match_code_chunks(
  query_embedding vector(1024),
  p_repository_id uuid,
  match_threshold float DEFAULT 0.5,
  match_count int DEFAULT 15
)
RETURNS TABLE (
  id uuid,
  file_path text,
  start_line int,
  end_line int,
  content text,
  language text,
  chunk_type text,
  symbol_name text,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    cc.id,
    cc.file_path,
    cc.start_line,
    cc.end_line,
    cc.content,
    cc.language,
    cc.chunk_type,
    cc.symbol_name,
    1 - (cc.embedding <=> query_embedding) AS similarity
  FROM code_chunks cc
  WHERE cc.repository_id = p_repository_id
    AND cc.embedding IS NOT NULL
    AND 1 - (cc.embedding <=> query_embedding) > match_threshold
  ORDER BY cc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Create function for hybrid search (vector + full-text)
CREATE OR REPLACE FUNCTION hybrid_search_code_chunks(
  query_embedding vector(1024),
  query_text text,
  p_repository_id uuid,
  vector_weight float DEFAULT 0.7,
  text_weight float DEFAULT 0.3,
  match_count int DEFAULT 15
)
RETURNS TABLE (
  id uuid,
  file_path text,
  start_line int,
  end_line int,
  content text,
  language text,
  chunk_type text,
  symbol_name text,
  combined_score float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH vector_results AS (
    SELECT
      cc.id,
      1 - (cc.embedding <=> query_embedding) AS vector_score
    FROM code_chunks cc
    WHERE cc.repository_id = p_repository_id
      AND cc.embedding IS NOT NULL
    ORDER BY cc.embedding <=> query_embedding
    LIMIT match_count * 2
  ),
  text_results AS (
    SELECT
      cc.id,
      ts_rank(to_tsvector('english', cc.content || ' ' || COALESCE(cc.symbol_name, '')),
              plainto_tsquery('english', query_text)) AS text_score
    FROM code_chunks cc
    WHERE cc.repository_id = p_repository_id
      AND to_tsvector('english', cc.content || ' ' || COALESCE(cc.symbol_name, ''))
          @@ plainto_tsquery('english', query_text)
    LIMIT match_count * 2
  ),
  combined AS (
    SELECT
      COALESCE(vr.id, tr.id) AS id,
      COALESCE(vr.vector_score, 0) * vector_weight +
      COALESCE(tr.text_score, 0) * text_weight AS combined_score
    FROM vector_results vr
    FULL OUTER JOIN text_results tr ON vr.id = tr.id
  )
  SELECT
    cc.id,
    cc.file_path,
    cc.start_line,
    cc.end_line,
    cc.content,
    cc.language,
    cc.chunk_type,
    cc.symbol_name,
    c.combined_score
  FROM combined c
  JOIN code_chunks cc ON cc.id = c.id
  ORDER BY c.combined_score DESC
  LIMIT match_count;
END;
$$;
