-- Token Usage table for tracking API consumption
-- Supports future billing/pricing features

CREATE TABLE IF NOT EXISTS token_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL, -- 'chat', 'indexing_context', 'indexing_embedding'
  model VARCHAR(50) NOT NULL, -- 'haiku', 'sonnet', 'devstral', 'voyage-code-3'
  input_tokens INTEGER NOT NULL,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_token_usage_user_id ON token_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_token_usage_created_at ON token_usage(created_at);
-- Composite index for aggregation queries (GROUP BY type for a specific user)
CREATE INDEX IF NOT EXISTS idx_token_usage_user_type ON token_usage(user_id, type);
-- Composite index for aggregation queries (GROUP BY model for a specific user)
CREATE INDEX IF NOT EXISTS idx_token_usage_user_model ON token_usage(user_id, model);

-- Comments for documentation
COMMENT ON TABLE token_usage IS 'Tracks API token consumption per user for billing purposes';
COMMENT ON COLUMN token_usage.type IS 'Usage type: chat, indexing_context, indexing_embedding';
COMMENT ON COLUMN token_usage.model IS 'Model used: haiku, sonnet, devstral, voyage-code-3';
COMMENT ON COLUMN token_usage.input_tokens IS 'Number of input/prompt tokens';
COMMENT ON COLUMN token_usage.output_tokens IS 'Number of output/completion tokens (0 for embeddings)';
