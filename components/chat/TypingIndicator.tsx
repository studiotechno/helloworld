'use client'

import { Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TypingIndicatorProps {
  className?: string
}

export function TypingIndicator({ className }: TypingIndicatorProps) {
  return (
    <div
      className={cn('flex gap-3 px-4 py-4', className)}
      role="status"
      aria-label="L'assistant est en train d'ecrire"
    >
      {/* Avatar */}
      <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
        <Sparkles className="size-4" />
      </div>

      {/* Typing dots container */}
      <div className="flex items-center gap-1 rounded-2xl rounded-bl-sm bg-secondary/50 px-4 py-3">
        <span
          className="size-2 animate-bounce rounded-full bg-primary"
          style={{ animationDelay: '-0.3s', animationDuration: '0.6s' }}
        />
        <span
          className="size-2 animate-bounce rounded-full bg-primary"
          style={{ animationDelay: '-0.15s', animationDuration: '0.6s' }}
        />
        <span
          className="size-2 animate-bounce rounded-full bg-primary"
          style={{ animationDuration: '0.6s' }}
        />
      </div>
    </div>
  )
}
