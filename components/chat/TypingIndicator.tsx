'use client'

import { cn } from '@/lib/utils'

interface TypingIndicatorProps {
  className?: string
}

export function TypingIndicator({ className }: TypingIndicatorProps) {
  return (
    <div
      className={cn('flex gap-2 px-2 py-3 sm:gap-3 sm:px-4 sm:py-4', className)}
      role="status"
      aria-label="L'assistant est en train d'ecrire"
    >
      {/* Avatar */}
      <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground sm:size-8">
        <svg className="size-3.5 sm:size-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="12" r="5" fill="currentColor" />
          <line x1="12" y1="1" x2="12" y2="5" stroke="currentColor" strokeWidth="1.5" opacity="0.4" />
          <line x1="12" y1="19" x2="12" y2="23" stroke="currentColor" strokeWidth="1.5" opacity="0.4" />
          <line x1="1" y1="12" x2="5" y2="12" stroke="currentColor" strokeWidth="1.5" opacity="0.4" />
          <line x1="19" y1="12" x2="23" y2="12" stroke="currentColor" strokeWidth="1.5" opacity="0.4" />
          <line x1="4.2" y1="4.2" x2="7" y2="7" stroke="currentColor" strokeWidth="1.5" opacity="0.25" />
          <line x1="17" y1="17" x2="19.8" y2="19.8" stroke="currentColor" strokeWidth="1.5" opacity="0.25" />
          <line x1="4.2" y1="19.8" x2="7" y2="17" stroke="currentColor" strokeWidth="1.5" opacity="0.25" />
          <line x1="17" y1="7" x2="19.8" y2="4.2" stroke="currentColor" strokeWidth="1.5" opacity="0.25" />
        </svg>
      </div>

      {/* Typing dots container */}
      <div className="flex items-center gap-1 rounded-xl rounded-bl-sm bg-secondary/50 px-3 py-2 sm:rounded-2xl sm:px-4 sm:py-3">
        <span
          className="size-1.5 animate-bounce rounded-full bg-primary sm:size-2"
          style={{ animationDelay: '-0.3s', animationDuration: '0.6s' }}
        />
        <span
          className="size-1.5 animate-bounce rounded-full bg-primary sm:size-2"
          style={{ animationDelay: '-0.15s', animationDuration: '0.6s' }}
        />
        <span
          className="size-1.5 animate-bounce rounded-full bg-primary sm:size-2"
          style={{ animationDuration: '0.6s' }}
        />
      </div>
    </div>
  )
}
