import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getCurrentUser } from '@/lib/auth/sync-user'
import { prisma } from '@/lib/db/prisma'
import { stripe, getStripePriceId, PLANS, type PlanId, type BillingInterval } from '@/lib/stripe'

const checkoutSchema = z.object({
  plan: z.enum(['pro', 'business']),
  interval: z.enum(['month', 'year']),
})

/**
 * POST /api/stripe/checkout
 *
 * Creates a Stripe Checkout session for subscription upgrade
 */
export async function POST(req: Request) {
  try {
    const user = await getCurrentUser()

    if (!user) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Non authentifie' } },
        { status: 401 }
      )
    }

    const body = await req.json()
    const parseResult = checkoutSchema.safeParse(body)

    if (!parseResult.success) {
      return NextResponse.json(
        { error: { code: 'INVALID_REQUEST', message: 'Plan ou interval invalide' } },
        { status: 400 }
      )
    }

    const { plan, interval } = parseResult.data

    // Get or create Stripe customer
    let subscription = await prisma.subscriptions.findUnique({
      where: { user_id: user.id },
    })

    let customerId = subscription?.stripe_customer_id

    if (!customerId) {
      // Create Stripe customer
      const customer = await stripe.customers.create({
        email: user.email || undefined,
        name: user.name || undefined,
        metadata: {
          userId: user.id,
          githubId: user.github_id,
        },
      })
      customerId = customer.id

      // Create subscription record with free plan
      subscription = await prisma.subscriptions.create({
        data: {
          user_id: user.id,
          stripe_customer_id: customerId,
          plan: 'free',
          status: 'active',
          token_limit: PLANS.free.tokenLimit,
          repo_limit: PLANS.free.repoLimit,
        },
      })
    }

    // Get Stripe price ID
    const priceId = getStripePriceId(plan as PlanId, interval as BillingInterval)

    if (!priceId) {
      return NextResponse.json(
        { error: { code: 'PRICE_NOT_FOUND', message: 'Prix Stripe non configure' } },
        { status: 500 }
      )
    }

    // Create Stripe Checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/pricing?checkout=canceled`,
      metadata: {
        userId: user.id,
        plan,
        interval,
      },
      subscription_data: {
        metadata: {
          userId: user.id,
          plan,
        },
      },
      allow_promotion_codes: true,
      billing_address_collection: 'required',
    })

    return NextResponse.json({ url: session.url })
  } catch (error) {
    console.error('[Stripe] Checkout error:', error)

    return NextResponse.json(
      {
        error: {
          code: 'CHECKOUT_FAILED',
          message: 'Erreur lors de la creation du checkout',
        },
      },
      { status: 500 }
    )
  }
}
