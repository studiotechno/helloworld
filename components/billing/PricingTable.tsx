'use client'

import { PLANS, type PlanId } from '@/lib/stripe'
import { PricingCard } from './PricingCard'

interface PricingTableProps {
  currentPlan?: PlanId
  isLoading?: boolean
}

export function PricingTable({ currentPlan, isLoading }: PricingTableProps) {
  const plans = Object.values(PLANS)

  return (
    <div className="grid gap-6 md:grid-cols-3 max-w-5xl mx-auto">
      {plans.map((plan) => (
        <PricingCard
          key={plan.id}
          plan={plan}
          currentPlan={currentPlan}
          isLoading={isLoading}
        />
      ))}
    </div>
  )
}
