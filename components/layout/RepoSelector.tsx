'use client'

import { useRouter } from 'next/navigation'
import { GitBranch, ChevronDown, FolderGit2, ArrowRightLeft, RefreshCw, Calendar, GitCommit, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import type { ConnectedRepository } from '@/hooks/useConnectRepo'
import { useIndexingStatus, getStatusLabel } from '@/hooks/useIndexingStatus'
import { IndexingBadge } from '@/components/repos/IndexingProgress'

/**
 * Format a date to a human-readable relative or absolute string
 */
function formatLastIndexedDate(dateString: string | undefined): string | null {
  if (!dateString) return null

  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMinutes = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffMinutes < 1) return "A l'instant"
  if (diffMinutes < 60) return `il y a ${diffMinutes} min`
  if (diffHours < 24) return `il y a ${diffHours}h`
  if (diffDays === 1) return 'Hier'
  if (diffDays < 7) return `il y a ${diffDays} jours`

  // Format as date for older entries
  return date.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  })
}

interface RepoSelectorProps {
  repo: ConnectedRepository | null
  isLoading?: boolean
  className?: string
}

export function RepoSelector({ repo, isLoading, className }: RepoSelectorProps) {
  const router = useRouter()

  // Fetch indexing status for the active repo
  const {
    status,
    statusData,
    isIndexed,
    isInProgress,
    startIndexing,
    isStarting,
    isLoading: isLoadingStatus,
  } = useIndexingStatus(repo?.id)

  // Format last indexed date
  const lastIndexedDate = formatLastIndexedDate(statusData?.completedAt)

  // Loading state
  if (isLoading) {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        <Skeleton className="h-9 w-40" />
      </div>
    )
  }

  // No repo connected
  if (!repo) {
    return (
      <Button
        variant="outline"
        onClick={() => router.push('/repos')}
        className={cn(
          'gap-2 border-dashed border-border/50 text-muted-foreground hover:text-foreground',
          className
        )}
      >
        <FolderGit2 className="size-4" />
        <span>Selectionnez un repository</span>
      </Button>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            'gap-2 border-border/50 hover:border-pink-500/50 hover:bg-accent',
            'focus:ring-2 focus:ring-pink-500/50 focus:ring-offset-2 focus:ring-offset-background',
            className
          )}
          aria-label={`Repository actif: ${repo.full_name}`}
        >
          <FolderGit2 className="size-4 text-pink-500" />
          <span className="max-w-[180px] truncate font-medium">
            {repo.full_name}
          </span>
          {!isLoadingStatus && (
            <IndexingBadge status={status} />
          )}
          <span className="flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
            <GitBranch className="size-3" />
            {repo.default_branch}
          </span>
          <ChevronDown className="size-4 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        <div className="px-2 py-1.5">
          <p className="text-sm font-medium">{repo.full_name}</p>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-xs text-muted-foreground">
              Branche : {repo.default_branch}
            </p>
            {!isLoadingStatus && (
              <span className="text-xs text-muted-foreground">
                • {getStatusLabel(status)}
              </span>
            )}
          </div>
          {/* Last indexed date and commit info */}
          {isIndexed && (
            <div className="mt-2 space-y-1">
              {lastIndexedDate && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Calendar className="size-3" />
                  <span>Indexé {lastIndexedDate}</span>
                </div>
              )}
              {statusData?.lastIndexedCommitShort && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <GitCommit className="size-3" />
                  <span>Commit:</span>
                  <a
                    href={`https://github.com/${repo.full_name}/commit/${statusData.lastIndexedCommitSha}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="font-mono px-1.5 py-0.5 rounded bg-muted hover:bg-primary/20 hover:text-primary transition-colors"
                  >
                    {statusData.lastIndexedCommitShort}
                  </a>
                </div>
              )}
              {/* Warning if newer commit available */}
              {statusData?.hasNewerCommit && (
                <div className="flex items-center gap-1.5 text-xs text-yellow-600 dark:text-yellow-500 mt-1.5 p-1.5 rounded-md bg-yellow-500/10">
                  <AlertTriangle className="size-3 shrink-0" />
                  <span>Nouveau commit:</span>
                  <a
                    href={`https://github.com/${repo.full_name}/commit/${statusData.latestCommitSha}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="font-mono px-1 py-0.5 rounded bg-yellow-500/20 hover:bg-yellow-500/30 transition-colors"
                  >
                    {statusData.latestCommitShort}
                  </a>
                </div>
              )}
            </div>
          )}
        </div>
        <DropdownMenuSeparator />
        {/* Re-index / Start indexing option */}
        <DropdownMenuItem
          onClick={() => startIndexing()}
          disabled={isInProgress || isStarting}
          className="gap-2 cursor-pointer"
        >
          <RefreshCw className={cn('size-4', (isInProgress || isStarting) && 'animate-spin')} />
          <span>
            {isInProgress
              ? 'Indéxation en cours...'
              : isIndexed
                ? 'Ré-indéxer'
                : 'Démarrer l\'indéxation'}
          </span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => router.push('/repos')}
          className="gap-2 cursor-pointer"
        >
          <ArrowRightLeft className="size-4" />
          <span>Changer de repository</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
