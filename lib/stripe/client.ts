import Stripe from 'stripe'

// Initialize Stripe client lazily to avoid build-time errors
// when STRIPE_SECRET_KEY is not set
let stripeClient: Stripe | null = null

export const stripe = new Proxy({} as Stripe, {
  get(_target, prop) {
    if (!stripeClient) {
      if (!process.env.STRIPE_SECRET_KEY) {
        throw new Error('STRIPE_SECRET_KEY is not set')
      }
      stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY, {
        apiVersion: '2025-12-15.clover',
        typescript: true,
      })
    }
    return (stripeClient as any)[prop]
  },
})
