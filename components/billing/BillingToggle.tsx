'use client'

import { cn } from '@/lib/utils'
import type { BillingInterval } from '@/lib/stripe'

interface BillingToggleProps {
  interval: BillingInterval
  onChange: (interval: BillingInterval) => void
}

export function BillingToggle({ interval, onChange }: BillingToggleProps) {
  return (
    <div className="flex items-center justify-center gap-4">
      <button
        onClick={() => onChange('month')}
        className={cn(
          'px-4 py-2 text-sm font-medium rounded-lg transition-colors',
          interval === 'month'
            ? 'bg-primary text-primary-foreground'
            : 'text-muted-foreground hover:text-foreground'
        )}
      >
        Mensuel
      </button>
      <button
        onClick={() => onChange('year')}
        className={cn(
          'px-4 py-2 text-sm font-medium rounded-lg transition-colors relative',
          interval === 'year'
            ? 'bg-primary text-primary-foreground'
            : 'text-muted-foreground hover:text-foreground'
        )}
      >
        Annuel
        <span className="absolute -top-2 -right-2 bg-green-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-semibold">
          -20%
        </span>
      </button>
    </div>
  )
}
