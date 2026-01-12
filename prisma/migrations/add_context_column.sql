-- Migration: Add context column for Contextual Retrieval
-- This column stores LLM-generated contextual descriptions for each code chunk
-- to improve retrieval quality

-- Add context column to code_chunks
ALTER TABLE code_chunks ADD COLUMN IF NOT EXISTS context TEXT;

-- Create index for context search (optional, for future text search)
-- CREATE INDEX IF NOT EXISTS code_chunks_context_idx ON code_chunks USING GIN (to_tsvector('simple', context));
