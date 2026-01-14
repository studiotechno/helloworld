import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/sync-user'
import { prisma } from '@/lib/db/prisma'
import { stripe } from '@/lib/stripe'

/**
 * POST /api/stripe/portal
 *
 * Creates a Stripe Customer Portal session for subscription management
 */
export async function POST() {
  try {
    const user = await getCurrentUser()

    if (!user) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Non authentifie' } },
        { status: 401 }
      )
    }

    // Get user's subscription
    const subscription = await prisma.subscriptions.findUnique({
      where: { user_id: user.id },
    })

    if (!subscription?.stripe_customer_id) {
      return NextResponse.json(
        { error: { code: 'NO_SUBSCRIPTION', message: 'Aucun abonnement trouve' } },
        { status: 404 }
      )
    }

    // Create Customer Portal session
    const session = await stripe.billingPortal.sessions.create({
      customer: subscription.stripe_customer_id,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings`,
    })

    return NextResponse.json({ url: session.url })
  } catch (error) {
    console.error('[Stripe] Portal error:', error)

    return NextResponse.json(
      {
        error: {
          code: 'PORTAL_FAILED',
          message: 'Erreur lors de la creation du portail',
        },
      },
      { status: 500 }
    )
  }
}
