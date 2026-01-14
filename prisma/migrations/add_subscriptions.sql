-- Subscriptions table for Stripe billing
-- Tracks user subscription state synced with Stripe

CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,

  -- Stripe identifiers
  stripe_customer_id VARCHAR(255) NOT NULL UNIQUE,
  stripe_subscription_id VARCHAR(255) UNIQUE,
  stripe_price_id VARCHAR(255),

  -- Plan details
  plan VARCHAR(50) NOT NULL DEFAULT 'free',        -- 'free', 'pro', 'business'
  status VARCHAR(50) NOT NULL DEFAULT 'active',    -- 'active', 'past_due', 'canceled', etc.
  billing_interval VARCHAR(10),                     -- 'month' or 'year'

  -- Limits (denormalized for fast access)
  token_limit INTEGER NOT NULL DEFAULT 40000,       -- Monthly token limit
  repo_limit INTEGER NOT NULL DEFAULT 1,            -- Max repos (-1 = unlimited)

  -- Billing period
  current_period_start TIMESTAMPTZ(6),
  current_period_end TIMESTAMPTZ(6),
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,

  -- Tracking
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_customer ON subscriptions(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_subscription ON subscriptions(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_plan ON subscriptions(plan);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);

-- Comments for documentation
COMMENT ON TABLE subscriptions IS 'User subscription state synced with Stripe';
COMMENT ON COLUMN subscriptions.plan IS 'Subscription plan: free, pro, business';
COMMENT ON COLUMN subscriptions.status IS 'Stripe subscription status';
COMMENT ON COLUMN subscriptions.token_limit IS 'Monthly token limit for the plan';
COMMENT ON COLUMN subscriptions.repo_limit IS 'Max repositories allowed (-1 = unlimited)';
