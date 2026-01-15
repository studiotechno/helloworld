'use client'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { BouncingDots } from './BouncingDots'

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
        <svg
          className={cn(
            'size-5 text-primary',
            'motion-safe:animate-pulse'
          )}
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
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
