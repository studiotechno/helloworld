/**
 * Subscription Plans Configuration
 *
 * Defines the pricing tiers, limits, and Stripe price IDs for each plan.
 */

export type PlanId = 'free' | 'pro' | 'business'
export type BillingInterval = 'month' | 'year'

export interface PlanConfig {
  id: PlanId
  name: string
  description: string
  tokenLimit: number
  repoLimit: number // -1 = unlimited
  priceMonthly: number // in EUR
  priceYearly: number // in EUR (total for year)
  stripePriceIdMonthly?: string
  stripePriceIdYearly?: string
  features: string[]
  highlighted?: boolean
}

export const PLANS: Record<PlanId, PlanConfig> = {
  free: {
    id: 'free',
    name: 'Free',
    description: 'Pour decouvrir la plateforme',
    tokenLimit: 40_000,
    repoLimit: 1,
    priceMonthly: 0,
    priceYearly: 0,
    features: [
      '40 000 tokens/mois',
      '1 repository',
      'Chat illimite',
      'Indexation de code',
    ],
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    description: 'Pour les developpeurs actifs',
    tokenLimit: 1_000_000,
    repoLimit: 5,
    priceMonthly: 19,
    priceYearly: 182.4, // 15.20€/mois
    stripePriceIdMonthly: process.env.STRIPE_PRICE_PRO_MONTHLY,
    stripePriceIdYearly: process.env.STRIPE_PRICE_PRO_YEARLY,
    features: [
      '1 000 000 tokens/mois',
      '5 repositories',
      'Support prioritaire',
      'Historique complet',
    ],
    highlighted: true,
  },
  business: {
    id: 'business',
    name: 'Business',
    description: 'Pour les equipes et projets ambitieux',
    tokenLimit: 4_000_000,
    repoLimit: -1, // unlimited
    priceMonthly: 60,
    priceYearly: 576, // 48€/mois
    stripePriceIdMonthly: process.env.STRIPE_PRICE_BUSINESS_MONTHLY,
    stripePriceIdYearly: process.env.STRIPE_PRICE_BUSINESS_YEARLY,
    features: [
      '4 000 000 tokens/mois',
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
 * Get Stripe price ID for a plan and interval
 */
export function getStripePriceId(
  planId: PlanId,
  interval: BillingInterval
): string | undefined {
  const plan = PLANS[planId]
  return interval === 'month' ? plan.stripePriceIdMonthly : plan.stripePriceIdYearly
}

/**
 * Get plan ID from Stripe price ID
 */
export function getPlanFromPriceId(priceId: string): PlanId {
  for (const [planId, config] of Object.entries(PLANS)) {
    if (
      config.stripePriceIdMonthly === priceId ||
      config.stripePriceIdYearly === priceId
    ) {
      return planId as PlanId
    }
  }
  return 'free'
}

/**
 * Format price for display
 */
export function formatPrice(amount: number, interval?: BillingInterval): string {
  if (amount === 0) return 'Gratuit'

  const formatted = new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount)

  if (interval === 'year') {
    return `${formatted}/an`
  }
  return `${formatted}/mois`
}

/**
 * Calculate monthly price from yearly
 */
export function getMonthlyFromYearly(yearlyPrice: number): number {
  return Math.round((yearlyPrice / 12) * 100) / 100
}

/**
 * Calculate savings percentage for annual billing
 */
export function getAnnualSavings(monthlyPrice: number, yearlyPrice: number): number {
  if (monthlyPrice === 0) return 0
  const monthlyTotal = monthlyPrice * 12
  return Math.round(((monthlyTotal - yearlyPrice) / monthlyTotal) * 100)
}
