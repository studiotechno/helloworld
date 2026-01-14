'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Check, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { type PlanConfig, formatPrice } from '@/lib/stripe'

interface PricingCardProps {
  plan: PlanConfig
  currentPlan?: string
  isLoading?: boolean
}

export function PricingCard({ plan, currentPlan, isLoading }: PricingCardProps) {
  const [checkoutLoading, setCheckoutLoading] = useState(false)

  const isCurrentPlan = currentPlan === plan.id
  const isFree = plan.id === 'free'

  const handleSubscribe = async () => {
    if (isFree || isCurrentPlan) return

    setCheckoutLoading(true)
    try {
      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: plan.id }),
      })

      const data = await response.json()

      if (data.url) {
        window.location.href = data.url
      } else {
        console.error('Checkout error:', data.error)
      }
    } catch (error) {
      console.error('Checkout error:', error)
    } finally {
      setCheckoutLoading(false)
    }
  }

  return (
    <Card
      className={cn(
        'relative flex flex-col border-border/50 bg-card/50 backdrop-blur-sm transition-all',
        plan.highlighted && 'border-primary shadow-lg shadow-primary/20 scale-105',
        isCurrentPlan && 'ring-2 ring-primary'
      )}
    >
      {plan.highlighted && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-xs font-semibold px-3 py-1 rounded-full">
          Populaire
        </div>
      )}

      {isCurrentPlan && (
        <div className="absolute -top-3 right-4 bg-green-500 text-white text-xs font-semibold px-3 py-1 rounded-full">
          Plan actuel
        </div>
      )}

      <CardHeader className="text-center pb-2">
        <CardTitle className="text-xl">{plan.name}</CardTitle>
        <CardDescription>{plan.description}</CardDescription>
      </CardHeader>

      <CardContent className="flex-1 space-y-6">
        {/* Price */}
        <div className="text-center">
          {isFree ? (
            <div className="text-4xl font-bold">Gratuit</div>
          ) : (
            <div className="text-4xl font-bold">
              {formatPrice(plan.price)}
              <span className="text-lg font-normal text-muted-foreground">/mois</span>
            </div>
          )}
        </div>

        {/* Features */}
        <ul className="space-y-3">
          {plan.features.map((feature, index) => (
            <li key={index} className="flex items-center gap-2">
              <Check className="size-4 text-green-500 shrink-0" />
              <span className="text-sm">{feature}</span>
            </li>
          ))}
        </ul>
      </CardContent>

      <CardFooter>
        <Button
          onClick={handleSubscribe}
          disabled={isCurrentPlan || checkoutLoading || isLoading}
          variant={plan.highlighted ? 'default' : 'outline'}
          className="w-full"
        >
          {checkoutLoading ? (
            <>
              <Loader2 className="size-4 animate-spin mr-2" />
              Chargement...
            </>
          ) : isCurrentPlan ? (
            'Plan actuel'
          ) : isFree ? (
            'Commencer gratuitement'
          ) : (
            'Choisir ce plan'
          )}
        </Button>
      </CardFooter>
    </Card>
  )
}
