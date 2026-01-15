'use client'

import { cn } from '@/lib/utils'

export interface Suggestion {
  emoji: string
  text: string
}

interface SuggestionChipsProps {
  suggestions: Suggestion[]
  onSelect?: (text: string) => void
  className?: string
}

export function SuggestionChips({
  suggestions,
  onSelect,
  className,
}: SuggestionChipsProps) {
  return (
    <div className={cn('flex flex-wrap justify-center gap-2 sm:gap-3', className)}>
      {suggestions.map((suggestion, index) => (
        <button
          key={index}
          onClick={() => onSelect?.(suggestion.text)}
          className={cn(
            'flex items-center gap-1.5 rounded-full px-3 py-2 sm:gap-2 sm:px-4 sm:py-2.5',
            'border border-border/50 bg-secondary/50',
            'text-xs text-muted-foreground sm:text-sm',
            'transition-all duration-200',
            'hover:-translate-y-0.5 hover:border-primary/50 hover:text-foreground',
            'hover:bg-secondary/80 hover:shadow-md hover:shadow-primary/10',
            'focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2 focus:ring-offset-background',
            'active:scale-95'
          )}
          type="button"
          role="button"
          aria-label={`Suggerer: ${suggestion.text}`}
        >
          <span className="text-sm sm:text-base">{suggestion.emoji}</span>
          <span>{suggestion.text}</span>
        </button>
      ))}
    </div>
  )
}
