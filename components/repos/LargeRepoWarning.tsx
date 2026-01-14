'use client'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { AlertTriangle, FolderTree, FileCode, Clock } from 'lucide-react'

// Priority folders that will be indexed for large repositories
const PRIORITY_FOLDERS = [
  'src',
  'lib',
  'app',
  'components',
  'pages',
  'api',
  'utils',
  'hooks',
  'services',
  'modules',
]

// Threshold for large repository warning (50k lines)
export const LARGE_REPO_THRESHOLD = 50000

export interface LargeRepoWarningProps {
  /** Whether the dialog is open */
  open: boolean
  /** Callback when dialog state changes */
  onOpenChange: (open: boolean) => void
  /** Repository name for display */
  repositoryName: string
  /** Estimated lines of code */
  estimatedLines: number
  /** Total number of files */
  totalFiles?: number
  /** Number of code files */
  codeFiles?: number
  /** Callback when user confirms to proceed */
  onProceed: () => void
  /** Callback when user cancels */
  onCancel: () => void
  /** Whether the proceed action is loading */
  isLoading?: boolean
}

/**
 * Format large numbers with k/M suffix
 */
function formatNumber(num: number): string {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`
  }
  if (num >= 1000) {
    return `${Math.round(num / 1000)}k`
  }
  return String(num)
}

/**
 * Estimate indexation time based on lines of code
 * Rough estimate: ~1000 lines per second for processing
 */
function estimateTime(lines: number): string {
  const seconds = Math.ceil(lines / 1000)
  if (seconds < 60) {
    return `~${seconds} secondes`
  }
  const minutes = Math.ceil(seconds / 60)
  if (minutes < 60) {
    return `~${minutes} minute${minutes > 1 ? 's' : ''}`
  }
  const hours = Math.ceil(minutes / 60)
  return `~${hours} heure${hours > 1 ? 's' : ''}`
}

/**
 * Warning dialog shown when connecting a large repository (>50k lines).
 * Explains the limitations and which folders will be prioritized.
 */
export function LargeRepoWarning({
  open,
  onOpenChange,
  repositoryName,
  estimatedLines,
  totalFiles: _totalFiles,
  codeFiles,
  onProceed,
  onCancel,
  isLoading = false,
}: LargeRepoWarningProps) {
  const handleCancel = () => {
    onCancel()
    onOpenChange(false)
  }

  const handleProceed = () => {
    onProceed()
    // Don't close immediately - let the parent control this after indexation starts
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-yellow-500/10">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
            </div>
            <AlertDialogTitle className="text-xl">
              Repository volumineux detecte
            </AlertDialogTitle>
          </div>
          <AlertDialogDescription asChild>
            <div className="space-y-4 pt-2">
              <p>
                Le repository <strong className="text-foreground">{repositoryName}</strong> contient
                environ <strong className="text-foreground">{formatNumber(estimatedLines)} lignes</strong> de code.
              </p>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-3 rounded-lg bg-muted/50 p-3">
                <div className="flex flex-col items-center gap-1">
                  <FileCode className="h-4 w-4 text-muted-foreground" />
                  <span className="text-lg font-semibold text-foreground">
                    {formatNumber(estimatedLines)}
                  </span>
                  <span className="text-xs text-muted-foreground">lignes</span>
                </div>
                {codeFiles !== undefined && (
                  <div className="flex flex-col items-center gap-1">
                    <FolderTree className="h-4 w-4 text-muted-foreground" />
                    <span className="text-lg font-semibold text-foreground">
                      {formatNumber(codeFiles)}
                    </span>
                    <span className="text-xs text-muted-foreground">fichiers code</span>
                  </div>
                )}
                <div className="flex flex-col items-center gap-1">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-lg font-semibold text-foreground">
                    {estimateTime(estimatedLines)}
                  </span>
                  <span className="text-xs text-muted-foreground">estimation</span>
                </div>
              </div>

              {/* What will happen */}
              <div className="space-y-2">
                <p className="font-medium text-foreground">
                  Pour optimiser l&apos;indexation :
                </p>
                <ul className="space-y-1.5 text-sm">
                  <li className="flex items-start gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-yellow-500 flex-shrink-0" />
                    <span>
                      Seuls les dossiers prioritaires seront indexes :
                      <span className="font-medium text-foreground">
                        {' '}{PRIORITY_FOLDERS.slice(0, 6).join(', ')}, etc.
                      </span>
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-yellow-500 flex-shrink-0" />
                    <span>
                      Les fichiers de configuration importants (package.json, schema.prisma, etc.) seront inclus
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-yellow-500 flex-shrink-0" />
                    <span>
                      L&apos;indexation peut prendre plusieurs minutes
                    </span>
                  </li>
                </ul>
              </div>

              <p className="text-sm text-muted-foreground">
                Vous pouvez commencer à utiliser le chat pendant l&apos;indexation, mais les réponses
                seront limitees jusqu&apos;a la fin du processus.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2 sm:gap-0">
          <AlertDialogCancel onClick={handleCancel} disabled={isLoading}>
            Annuler
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleProceed}
            disabled={isLoading}
            className="bg-yellow-500 hover:bg-yellow-600 text-black"
          >
            {isLoading ? 'Demarrage...' : 'Continuer l\'indexation'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

/**
 * Helper to check if a repository needs the large repo warning
 */
export function isLargeRepository(estimatedLines: number): boolean {
  return estimatedLines > LARGE_REPO_THRESHOLD
}

/**
 * Helper hook props type for integration with other components
 */
export interface UseLargeRepoWarningResult {
  showWarning: boolean
  warningProps: Omit<LargeRepoWarningProps, 'onProceed' | 'onCancel'>
  checkAndShowWarning: (stats: { estimatedLines: number; codeFiles?: number; totalFiles?: number }) => boolean
  hideWarning: () => void
}
