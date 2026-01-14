import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { stripe, PLANS, getPlanFromPriceId } from '@/lib/stripe'
import { prisma } from '@/lib/db/prisma'
import type Stripe from 'stripe'

/**
 * POST /api/stripe/webhooks
 *
 * Handles Stripe webhook events for subscription lifecycle
 */
export async function POST(req: Request) {
  const body = await req.text()
  const headersList = await headers()
  const signature = headersList.get('stripe-signature')

  if (!signature) {
    console.error('[Webhook] Missing stripe-signature header')
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
  }

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch (err) {
    console.error('[Webhook] Signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  console.log(`[Webhook] Received event: ${event.type}`)

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session)
        break

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription)
        break

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription)
        break

      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object as Stripe.Invoice)
        break

      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(event.data.object as Stripe.Invoice)
        break

      default:
        console.log(`[Webhook] Unhandled event type: ${event.type}`)
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('[Webhook] Handler error:', error)
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 })
  }
}

/**
 * Handle successful checkout session
 */
async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  if (session.mode !== 'subscription' || !session.subscription) {
    return
  }

  const subscriptionData = await stripe.subscriptions.retrieve(
    session.subscription as string
  )
  // Cast to access subscription properties
  const subscription = subscriptionData as Stripe.Subscription

  const customerId = session.customer as string
  const plan = (session.metadata?.plan as 'pro' | 'business') || 'pro'
  const planConfig = PLANS[plan]

  console.log(`[Webhook] Checkout completed for customer ${customerId}, plan: ${plan}`)

  await prisma.subscriptions.update({
    where: { stripe_customer_id: customerId },
    data: {
      stripe_subscription_id: subscription.id,
      stripe_price_id: subscription.items.data[0].price.id,
      plan,
      status: 'active',
      billing_interval: subscription.items.data[0].price.recurring?.interval as
        | 'month'
        | 'year',
      token_limit: planConfig.tokenLimit,
      repo_limit: planConfig.repoLimit,
      current_period_start: new Date((subscription as any).current_period_start * 1000),
      current_period_end: new Date((subscription as any).current_period_end * 1000),
      cancel_at_period_end: (subscription as any).cancel_at_period_end ?? false,
    },
  })
}

/**
 * Handle subscription updates (plan changes, renewals)
 */
async function handleSubscriptionUpdated(sub: Stripe.Subscription) {
  const subscription = sub as any // Cast to access all properties
  const priceId = subscription.items.data[0].price.id
  const plan = getPlanFromPriceId(priceId)
  const planConfig = PLANS[plan]

  console.log(
    `[Webhook] Subscription ${subscription.id} updated, status: ${subscription.status}, plan: ${plan}`
  )

  try {
    await prisma.subscriptions.update({
      where: { stripe_subscription_id: subscription.id },
      data: {
        stripe_price_id: priceId,
        plan,
        status: subscription.status,
        billing_interval: subscription.items.data[0].price.recurring?.interval as
          | 'month'
          | 'year',
        token_limit: planConfig.tokenLimit,
        repo_limit: planConfig.repoLimit,
        current_period_start: new Date(subscription.current_period_start * 1000),
        current_period_end: new Date(subscription.current_period_end * 1000),
        cancel_at_period_end: subscription.cancel_at_period_end ?? false,
      },
    })
  } catch (error) {
    // Subscription might not exist yet if this is the first event
    console.log('[Webhook] Subscription not found, might be new:', subscription.id)
  }
}

/**
 * Handle subscription cancellation (downgrade to free)
 */
async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  console.log(`[Webhook] Subscription ${subscription.id} deleted, downgrading to free`)

  try {
    await prisma.subscriptions.update({
      where: { stripe_subscription_id: subscription.id },
      data: {
        stripe_subscription_id: null,
        stripe_price_id: null,
        plan: 'free',
        status: 'canceled',
        billing_interval: null,
        token_limit: PLANS.free.tokenLimit,
        repo_limit: PLANS.free.repoLimit,
        cancel_at_period_end: false,
        current_period_start: null,
        current_period_end: null,
      },
    })
  } catch (error) {
    console.error('[Webhook] Error downgrading subscription:', error)
  }
}

/**
 * Handle failed payment
 */
async function handlePaymentFailed(invoice: Stripe.Invoice) {
  const inv = invoice as any
  if (!inv.subscription) return

  console.log(`[Webhook] Payment failed for subscription ${inv.subscription}`)

  try {
    await prisma.subscriptions.update({
      where: { stripe_subscription_id: inv.subscription as string },
      data: { status: 'past_due' },
    })
  } catch (error) {
    console.error('[Webhook] Error updating subscription status:', error)
  }
}

/**
 * Handle successful payment (reactivate if was past_due)
 */
async function handlePaymentSucceeded(invoice: Stripe.Invoice) {
  const inv = invoice as any
  if (!inv.subscription) return

  console.log(`[Webhook] Payment succeeded for subscription ${inv.subscription}`)

  try {
    const subscription = await prisma.subscriptions.findUnique({
      where: { stripe_subscription_id: inv.subscription as string },
    })

    if (subscription?.status === 'past_due') {
      await prisma.subscriptions.update({
        where: { stripe_subscription_id: inv.subscription as string },
        data: { status: 'active' },
      })
    }
  } catch (error) {
    console.error('[Webhook] Error updating subscription status:', error)
  }
}
