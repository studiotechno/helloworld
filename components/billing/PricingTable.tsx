'use client'

import { useState } from 'react'
import { PLANS, type BillingInterval, type PlanId } from '@/lib/stripe'
import { BillingToggle } from './BillingToggle'
import { PricingCard } from './PricingCard'

interface PricingTableProps {
  currentPlan?: PlanId
  isLoading?: boolean
}

export function PricingTable({ currentPlan, isLoading }: PricingTableProps) {
  const [interval, setInterval] = useState<BillingInterval>('month')

  const plans = Object.values(PLANS)

  return (
    <div className="space-y-8">
      <BillingToggle interval={interval} onChange={setInterval} />

      <div className="grid gap-6 md:grid-cols-3 max-w-5xl mx-auto">
        {plans.map((plan) => (
          <PricingCard
            key={plan.id}
            plan={plan}
            interval={interval}
            currentPlan={currentPlan}
            isLoading={isLoading}
          />
        ))}
      </div>
    </div>
  )
}
