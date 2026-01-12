-- Migration: Optimized Hybrid Search with BM25-style full-text search
-- This migration adds persistent tsvector column and GIN indexes for fast hybrid search

-- 1. Enable pg_trgm extension for better text matching (trigram similarity)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. Add persistent search_vector column (tsvector) for full-text search
ALTER TABLE code_chunks ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- 3. Create GIN index on search_vector for fast full-text search
-- This is the main index for BM25-style lexical search
CREATE INDEX IF NOT EXISTS code_chunks_search_vector_idx
ON code_chunks
USING GIN (search_vector);

-- 4. Create GIN index for trigram search on file_path (for pattern matching)
CREATE INDEX IF NOT EXISTS code_chunks_file_path_trgm_idx
ON code_chunks
USING GIN (file_path gin_trgm_ops);

-- 5. Create GIN index for trigram search on symbol_name (for pattern matching)
CREATE INDEX IF NOT EXISTS code_chunks_symbol_name_trgm_idx
ON code_chunks
USING GIN (symbol_name gin_trgm_ops)
WHERE symbol_name IS NOT NULL;

-- 6. Function to generate search vector from chunk content
-- Weights: A = symbol_name (highest), B = file_path, C = content, D = dependencies
CREATE OR REPLACE FUNCTION generate_chunk_search_vector(
  p_content text,
  p_symbol_name text,
  p_file_path text,
  p_chunk_type text,
  p_dependencies text[]
)
RETURNS tsvector
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  result tsvector;
BEGIN
  -- Build weighted tsvector combining all searchable fields
  result :=
    -- Symbol name gets highest weight (A)
    setweight(to_tsvector('simple', COALESCE(p_symbol_name, '')), 'A') ||
    -- File path gets weight B (extract filename from path)
    setweight(to_tsvector('simple',
      regexp_replace(COALESCE(p_file_path, ''), '^.*/', '')), 'B') ||
    -- Chunk type gets weight B
    setweight(to_tsvector('simple', COALESCE(p_chunk_type, '')), 'B') ||
    -- Content gets weight C
    setweight(to_tsvector('simple', COALESCE(p_content, '')), 'C') ||
    -- Dependencies get lowest weight (D)
    setweight(to_tsvector('simple',
      array_to_string(COALESCE(p_dependencies, ARRAY[]::text[]), ' ')), 'D');

  RETURN result;
END;
$$;

-- 7. Trigger function to automatically update search_vector on insert/update
CREATE OR REPLACE FUNCTION update_code_chunk_search_vector()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.search_vector := generate_chunk_search_vector(
    NEW.content,
    NEW.symbol_name,
    NEW.file_path,
    NEW.chunk_type,
    NEW.dependencies
  );
  RETURN NEW;
END;
$$;

-- 8. Create trigger to update search_vector automatically
DROP TRIGGER IF EXISTS code_chunks_search_vector_trigger ON code_chunks;
CREATE TRIGGER code_chunks_search_vector_trigger
BEFORE INSERT OR UPDATE OF content, symbol_name, file_path, chunk_type, dependencies
ON code_chunks
FOR EACH ROW
EXECUTE FUNCTION update_code_chunk_search_vector();

-- 9. Backfill existing rows with search_vector
UPDATE code_chunks
SET search_vector = generate_chunk_search_vector(
  content,
  symbol_name,
  file_path,
  chunk_type,
  dependencies
)
WHERE search_vector IS NULL;

-- 10. Optimized hybrid search function using persistent search_vector
-- Uses Reciprocal Rank Fusion (RRF) to combine vector and lexical results
CREATE OR REPLACE FUNCTION hybrid_search_code_chunks_v2(
  query_embedding vector(1024),
  query_text text,
  p_repository_id uuid,
  rrf_k int DEFAULT 60,          -- RRF constant (higher = smoother blending)
  match_count int DEFAULT 15,
  vector_limit int DEFAULT 50,   -- How many vector results to consider
  text_limit int DEFAULT 50      -- How many text results to consider
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
  vector_score float,
  text_score float,
  rrf_score float
)
LANGUAGE plpgsql
AS $$
DECLARE
  tsquery_parsed tsquery;
BEGIN
  -- Parse query text into tsquery (handle special characters)
  tsquery_parsed := plainto_tsquery('simple', query_text);

  RETURN QUERY
  WITH
  -- Vector similarity search results
  vector_results AS (
    SELECT
      cc.id,
      ROW_NUMBER() OVER (ORDER BY cc.embedding <=> query_embedding) AS rank,
      1 - (cc.embedding <=> query_embedding) AS score
    FROM code_chunks cc
    WHERE cc.repository_id = p_repository_id
      AND cc.embedding IS NOT NULL
    ORDER BY cc.embedding <=> query_embedding
    LIMIT vector_limit
  ),
  -- Full-text search results using persistent search_vector
  text_results AS (
    SELECT
      cc.id,
      ROW_NUMBER() OVER (ORDER BY ts_rank_cd(cc.search_vector, tsquery_parsed) DESC) AS rank,
      ts_rank_cd(cc.search_vector, tsquery_parsed) AS score
    FROM code_chunks cc
    WHERE cc.repository_id = p_repository_id
      AND cc.search_vector @@ tsquery_parsed
    ORDER BY ts_rank_cd(cc.search_vector, tsquery_parsed) DESC
    LIMIT text_limit
  ),
  -- Combine using Reciprocal Rank Fusion
  rrf_combined AS (
    SELECT
      COALESCE(vr.id, tr.id) AS id,
      COALESCE(vr.score, 0) AS vector_score,
      COALESCE(tr.score, 0) AS text_score,
      COALESCE(1.0 / (rrf_k + vr.rank), 0) +
      COALESCE(1.0 / (rrf_k + tr.rank), 0) AS rrf_score
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
    r.vector_score::float,
    r.text_score::float,
    r.rrf_score::float
  FROM rrf_combined r
  JOIN code_chunks cc ON cc.id = r.id
  ORDER BY r.rrf_score DESC
  LIMIT match_count;
END;
$$;

-- 11. Specialized symbol search function (for exact function/class name lookups)
CREATE OR REPLACE FUNCTION search_code_symbols(
  p_symbol_pattern text,
  p_repository_id uuid,
  p_chunk_type text DEFAULT NULL,
  match_count int DEFAULT 20
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
    similarity(cc.symbol_name, p_symbol_pattern) AS similarity
  FROM code_chunks cc
  WHERE cc.repository_id = p_repository_id
    AND cc.symbol_name IS NOT NULL
    AND cc.symbol_name % p_symbol_pattern  -- Trigram similarity
    AND (p_chunk_type IS NULL OR cc.chunk_type = p_chunk_type)
  ORDER BY similarity(cc.symbol_name, p_symbol_pattern) DESC
  LIMIT match_count;
END;
$$;

-- 12. File path search function (for finding files by pattern)
CREATE OR REPLACE FUNCTION search_code_files(
  p_file_pattern text,
  p_repository_id uuid,
  match_count int DEFAULT 20
)
RETURNS TABLE (
  file_path text,
  chunk_count bigint
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    cc.file_path,
    COUNT(*) AS chunk_count
  FROM code_chunks cc
  WHERE cc.repository_id = p_repository_id
    AND cc.file_path % p_file_pattern  -- Trigram similarity
  GROUP BY cc.file_path
  ORDER BY similarity(cc.file_path, p_file_pattern) DESC
  LIMIT match_count;
END;
$$;
