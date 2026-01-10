'use client'

import { cn } from '@/lib/utils'

interface BouncingDotsProps {
  className?: string
}

/**
 * Animated bouncing dots indicator for loading states
 * Respects reduced motion preferences
 */
export function BouncingDots({ className }: BouncingDotsProps) {
  return (
    <div
      className={cn('flex items-center gap-1', className)}
      aria-hidden="true"
    >
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className={cn(
            'size-1.5 rounded-full bg-primary',
            'motion-safe:animate-bounce'
          )}
          style={{
            animationDelay: `${i * 0.15}s`,
            animationDuration: '0.6s',
          }}
        />
      ))}
    </div>
  )
}
