-- Migration: Add user_instructions table for personalized AI responses
-- This table stores user profile and team context to customize chat responses

-- Create user_instructions table
CREATE TABLE IF NOT EXISTS user_instructions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  profile_instructions TEXT,
  team_instructions TEXT,
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),

  -- Foreign key to users table with cascade delete
  CONSTRAINT fk_user_instructions_user
    FOREIGN KEY (user_id)
    REFERENCES users(id)
    ON DELETE CASCADE
);

-- Create index on user_id for faster lookups
CREATE INDEX IF NOT EXISTS user_instructions_user_id_idx ON user_instructions(user_id);

-- Comment on table
COMMENT ON TABLE user_instructions IS 'Stores personalized context for AI responses';
COMMENT ON COLUMN user_instructions.profile_instructions IS 'User profile description (role, tech level, communication preferences)';
COMMENT ON COLUMN user_instructions.team_instructions IS 'Team structure description (size, technologies, methodology)';
