/**
 * Subscription Limits Checker
 *
 * Provides functions to check user's token and repository limits
 * based on their current subscription plan.
 */

import { prisma } from '@/lib/db/prisma'
import { PLANS, type PlanId } from './config'

export interface UsageLimits {
  // Token usage
  tokensUsed: number
  tokenLimit: number
  tokensRemaining: number
  tokenUsagePercent: number
  isTokenLimitReached: boolean

  // Repository usage
  reposConnected: number
  repoLimit: number
  reposRemaining: number
  canConnectMoreRepos: boolean

  // Plan info
  plan: PlanId
  status: string
  currentPeriodEnd: Date | null
}

export interface TokenLimitCheck {
  allowed: boolean
  remaining: number
  limit: number
  used: number
  percent: number
}

export interface RepoLimitCheck {
  allowed: boolean
  current: number
  limit: number
  remaining: number
}

/**
 * Get comprehensive usage limits for a user
 */
export async function getUserLimits(userId: string): Promise<UsageLimits> {
  // Get subscription (or default to free plan values)
  const subscription = await prisma.subscriptions.findUnique({
    where: { user_id: userId },
  })

  const plan = (subscription?.plan as PlanId) || 'free'
  const planConfig = PLANS[plan]
  const tokenLimit = subscription?.token_limit ?? planConfig.tokenLimit
  const repoLimit = subscription?.repo_limit ?? planConfig.repoLimit
  const status = subscription?.status ?? 'active'
  const currentPeriodEnd = subscription?.current_period_end ?? null

  // Determine period start for token counting
  // Use subscription period or start of current month
  const periodStart =
    subscription?.current_period_start ??
    new Date(new Date().getFullYear(), new Date().getMonth(), 1)

  // Get token usage for current period (chat only, exclude indexing)
  const tokenUsage = await prisma.token_usage.aggregate({
    where: {
      user_id: userId,
      created_at: { gte: periodStart },
      type: 'chat',
    },
    _sum: {
      input_tokens: true,
      output_tokens: true,
    },
  })

  const tokensUsed =
    (tokenUsage._sum.input_tokens ?? 0) + (tokenUsage._sum.output_tokens ?? 0)
  const tokensRemaining = Math.max(0, tokenLimit - tokensUsed)
  const tokenUsagePercent = Math.min(100, Math.round((tokensUsed / tokenLimit) * 100))

  // Count connected repositories
  const repoCount = await prisma.repositories.count({
    where: { user_id: userId },
  })

  // Calculate remaining repos (-1 means unlimited)
  const reposRemaining = repoLimit === -1 ? Infinity : Math.max(0, repoLimit - repoCount)
  const canConnectMoreRepos = repoLimit === -1 || repoCount < repoLimit

  return {
    tokensUsed,
    tokenLimit,
    tokensRemaining,
    tokenUsagePercent,
    isTokenLimitReached: tokensUsed >= tokenLimit,
    reposConnected: repoCount,
    repoLimit,
    reposRemaining: reposRemaining === Infinity ? -1 : reposRemaining,
    canConnectMoreRepos,
    plan,
    status,
    currentPeriodEnd,
  }
}

/**
 * Quick check if user can make a token-consuming request
 * Use this before chat or indexing operations
 */
export async function checkTokenLimit(userId: string): Promise<TokenLimitCheck> {
  const limits = await getUserLimits(userId)

  return {
    allowed: !limits.isTokenLimitReached && limits.status === 'active',
    remaining: limits.tokensRemaining,
    limit: limits.tokenLimit,
    used: limits.tokensUsed,
    percent: limits.tokenUsagePercent,
  }
}

/**
 * Quick check if user can connect another repository
 * Use this before repo connection
 */
export async function checkRepoLimit(userId: string): Promise<RepoLimitCheck> {
  const limits = await getUserLimits(userId)

  return {
    allowed: limits.canConnectMoreRepos && limits.status === 'active',
    current: limits.reposConnected,
    limit: limits.repoLimit,
    remaining: limits.reposRemaining,
  }
}

/**
 * Get or create a subscription record for a user
 * Used during Stripe customer creation
 */
export async function getOrCreateSubscription(
  userId: string,
  stripeCustomerId: string
): Promise<{ id: string; isNew: boolean }> {
  const existing = await prisma.subscriptions.findUnique({
    where: { user_id: userId },
  })

  if (existing) {
    return { id: existing.id, isNew: false }
  }

  const created = await prisma.subscriptions.create({
    data: {
      user_id: userId,
      stripe_customer_id: stripeCustomerId,
      plan: 'free',
      status: 'active',
      token_limit: PLANS.free.tokenLimit,
      repo_limit: PLANS.free.repoLimit,
    },
  })

  return { id: created.id, isNew: true }
}
