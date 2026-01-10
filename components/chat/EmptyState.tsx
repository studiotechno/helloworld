'use client'

import { MessageSquare } from 'lucide-react'
import { SuggestionChips, Suggestion } from './SuggestionChips'
import { cn } from '@/lib/utils'

interface EmptyStateProps {
  onSuggestionClick?: (suggestion: string) => void
}

const defaultSuggestions: Suggestion[] = [
  { emoji: '🔧', text: "C'est quoi la stack technique?" },
  { emoji: '🎯', text: 'Quelles sont les features principales?' },
  { emoji: '🗄️', text: 'Montre-moi le schema de la BDD' },
  { emoji: '📁', text: 'Comment est structure le projet?' },
]

export function EmptyState({ onSuggestionClick }: EmptyStateProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 px-4 py-12">
      {/* Icon with glow effect */}
      <div className="relative">
        {/* Glow background */}
        <div
          className={cn(
            'absolute inset-0 rounded-full blur-2xl',
            'bg-primary/20 animate-pulse'
          )}
          style={{ transform: 'scale(1.5)' }}
        />
        {/* Icon container */}
        <div
          className={cn(
            'relative rounded-2xl p-6',
            'bg-gradient-to-br from-primary/20 to-primary/5',
            'border border-primary/20'
          )}
        >
          <MessageSquare className="size-12 text-primary" />
        </div>
      </div>

      {/* Gradient title and description */}
      <div className="space-y-3 text-center">
        <h2
          className={cn(
            'text-2xl font-bold md:text-3xl',
            'bg-gradient-to-r from-primary via-pink-400 to-primary',
            'bg-clip-text text-transparent',
            'animate-gradient bg-[length:200%_auto]'
          )}
        >
          Posez votre premiere question
        </h2>
        <p className="mx-auto max-w-md text-muted-foreground">
          Interrogez votre codebase en langage naturel. Je suis la pour vous
          aider a comprendre votre code.
        </p>
      </div>

      {/* Suggestion chips */}
      <SuggestionChips
        suggestions={defaultSuggestions}
        onSelect={onSuggestionClick}
        className="max-w-2xl"
      />
    </div>
  )
}
