/**
 * Subscription Plans Configuration
 *
 * Defines the pricing tiers, limits, and Stripe price IDs for each plan.
 */

export type PlanId = 'free' | 'plus' | 'pro'

export interface PlanConfig {
  id: PlanId
  name: string
  description: string
  tokenLimit: number
  repoLimit: number // -1 = unlimited
  price: number // in EUR per month
  stripePriceId?: string
  features: string[]
  highlighted?: boolean
}

export const PLANS: Record<PlanId, PlanConfig> = {
  free: {
    id: 'free',
    name: 'Starter',
    description: 'Pour decouvrir la plateforme',
    tokenLimit: 40_000,
    repoLimit: 1,
    price: 0,
    features: [
      '40K tokens/mois',
      '1 repository',
      'Chat illimite',
      'Indexation de code',
    ],
  },
  plus: {
    id: 'plus',
    name: 'Plus',
    description: 'Pour les developpeurs actifs',
    tokenLimit: 1_000_000,
    repoLimit: 5,
    price: 19,
    stripePriceId: process.env.STRIPE_PRICE_PLUS,
    features: [
      '1M tokens/mois',
      '5 repositories',
      'Support prioritaire',
      'Historique complet',
    ],
    highlighted: true,
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    description: 'Pour les equipes et projets ambitieux',
    tokenLimit: 4_000_000,
    repoLimit: -1, // unlimited
    price: 60,
    stripePriceId: process.env.STRIPE_PRICE_PRO,
    features: [
      '4M tokens/mois',
      'Repositories illimites',
      'Support dedie',
      'API access',
    ],
  },
}

/**
 * Get plan configuration by ID
 */
export function getPlan(planId: PlanId): PlanConfig {
  return PLANS[planId]
}

/**
 * Get Stripe price ID for a plan
 */
export function getStripePriceId(planId: PlanId): string | undefined {
  return PLANS[planId].stripePriceId
}

/**
 * Get plan ID from Stripe price ID
 */
export function getPlanFromPriceId(priceId: string): PlanId {
  for (const [planId, config] of Object.entries(PLANS)) {
    if (config.stripePriceId === priceId) {
      return planId as PlanId
    }
  }
  return 'free'
}

/**
 * Format price for display
 */
export function formatPrice(amount: number): string {
  if (amount === 0) return 'Gratuit'

  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}
