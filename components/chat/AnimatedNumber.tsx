'use client'

import { useEffect, useState, useRef } from 'react'
import { cn } from '@/lib/utils'

interface AnimatedNumberProps {
  value: number
  duration?: number
  className?: string
}

/**
 * Animated number that counts up to the target value
 * Uses requestAnimationFrame for smooth animation
 * Respects reduced motion preferences
 */
export function AnimatedNumber({
  value,
  duration = 500,
  className,
}: AnimatedNumberProps) {
  const [displayValue, setDisplayValue] = useState(0)
  const previousValue = useRef(0)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    // Check for reduced motion preference
    const prefersReducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches

    if (prefersReducedMotion) {
      setDisplayValue(value)
      previousValue.current = value
      return
    }

    const start = previousValue.current
    const startTime = Date.now()

    const animate = () => {
      const elapsed = Date.now() - startTime
      const progress = Math.min(elapsed / duration, 1)

      // Ease-out cubic function
      const eased = 1 - Math.pow(1 - progress, 3)
      const current = Math.floor(start + (value - start) * eased)

      setDisplayValue(current)

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate)
      } else {
        previousValue.current = value
      }
    }

    rafRef.current = requestAnimationFrame(animate)

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
      }
    }
  }, [value, duration])

  return (
    <span className={cn('tabular-nums', className)}>{displayValue}</span>
  )
}
