import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/sync-user'
import { prisma } from '@/lib/db/prisma'
import { getUserLimits, PLANS, type PlanId } from '@/lib/stripe'

export interface SubscriptionResponse {
  plan: PlanId
  planName: string
  status: string
  billingInterval: string | null
  tokenLimit: number
  tokensUsed: number
  tokensRemaining: number
  tokenUsagePercent: number
  repoLimit: number
  reposConnected: number
  canConnectMoreRepos: boolean
  currentPeriodEnd: string | null
  cancelAtPeriodEnd: boolean
}

/**
 * GET /api/user/subscription
 *
 * Returns the current user's subscription details and usage
 */
export async function GET() {
  try {
    const user = await getCurrentUser()

    if (!user) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Non authentifie' } },
        { status: 401 }
      )
    }

    const [limits, subscription] = await Promise.all([
      getUserLimits(user.id),
      prisma.subscriptions.findUnique({
        where: { user_id: user.id },
        select: { cancel_at_period_end: true, billing_interval: true },
      }),
    ])
    const planConfig = PLANS[limits.plan]

    const response: SubscriptionResponse = {
      plan: limits.plan,
      planName: planConfig.name,
      status: limits.status,
      billingInterval: subscription?.billing_interval ?? null,
      tokenLimit: limits.tokenLimit,
      tokensUsed: limits.tokensUsed,
      tokensRemaining: limits.tokensRemaining,
      tokenUsagePercent: limits.tokenUsagePercent,
      repoLimit: limits.repoLimit,
      reposConnected: limits.reposConnected,
      canConnectMoreRepos: limits.canConnectMoreRepos,
      currentPeriodEnd: limits.currentPeriodEnd?.toISOString() ?? null,
      cancelAtPeriodEnd: subscription?.cancel_at_period_end ?? false,
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('[API] Subscription fetch error:', error)

    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: "Impossible de recuperer l'abonnement",
        },
      },
      { status: 500 }
    )
  }
}
