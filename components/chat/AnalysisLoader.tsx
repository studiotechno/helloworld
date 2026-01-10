'use client'

import { Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { BouncingDots } from './BouncingDots'
import { AnimatedNumber } from './AnimatedNumber'

export type AnalysisPhase = 'loading' | 'scanning' | 'processing' | 'timeout'

export interface AnalysisLoaderProps {
  phase: AnalysisPhase
  message?: string
  filesAnalyzed?: number
  foldersAnalyzed?: number
  onCancel?: () => void
  className?: string
}

/**
 * Get default message for each phase
 */
function getPhaseMessage(phase: AnalysisPhase): string {
  switch (phase) {
    case 'loading':
      return 'Analyse en cours...'
    case 'scanning':
      return 'Lecture des fichiers...'
    case 'processing':
      return 'Traitement des resultats...'
    case 'timeout':
      return 'Cette analyse prend plus de temps que prevu...'
    default:
      return 'Analyse en cours...'
  }
}

/**
 * Visual feedback component for long-running analyses
 * Shows progress, file counts, and allows cancellation after 30s
 */
export function AnalysisLoader({
  phase,
  message,
  filesAnalyzed = 0,
  foldersAnalyzed = 0,
  onCancel,
  className,
}: AnalysisLoaderProps) {
  const displayMessage = message || getPhaseMessage(phase)
  const showProgress = phase !== 'loading'

  return (
    <div
      className={cn('flex items-start gap-3 px-4 py-4', className)}
      role="status"
      aria-live="polite"
      aria-atomic="true"
      aria-label={`Analyse en cours: ${displayMessage}`}
    >
      {/* Animated Icon with Glow */}
      <div className="relative flex size-8 shrink-0 items-center justify-center">
        <Search
          className={cn(
            'size-5 text-primary',
            'motion-safe:animate-pulse'
          )}
          aria-hidden="true"
        />
        <div
          className={cn(
            'absolute inset-0 rounded-full bg-primary/20',
            'motion-safe:animate-ping'
          )}
          aria-hidden="true"
        />
      </div>

      <div className="flex-1 space-y-2">
        {/* Main Message */}
        <p className="text-sm font-medium text-foreground">{displayMessage}</p>

        {/* Progress Details */}
        {showProgress && filesAnalyzed > 0 && (
          <p className="text-xs text-muted-foreground">
            <AnimatedNumber value={filesAnalyzed} /> fichiers analyses dans{' '}
            <AnimatedNumber value={foldersAnalyzed} /> dossiers
          </p>
        )}

        {/* Bouncing Dots */}
        <BouncingDots />

        {/* Cancel Button in timeout phase */}
        {phase === 'timeout' && onCancel && (
          <div className="pt-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={onCancel}
              className="h-6 px-2 text-xs"
            >
              Annuler
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
