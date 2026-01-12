'use client'

import { useRouter } from 'next/navigation'
import { Database, Calendar, GitCommit, ExternalLink, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useIndexedRepos, useActivateRepo, useActiveRepo } from '@/hooks'
import { Skeleton } from '@/components/ui/skeleton'

function formatRelativeDate(dateString: string | null): string | null {
  if (!dateString) return null

  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMinutes = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffMinutes < 1) return "à l'instant"
  if (diffMinutes < 60) return `il y a ${diffMinutes} min`
  if (diffHours < 24) return `il y a ${diffHours}h`
  if (diffDays === 1) return 'hier'
  if (diffDays < 7) return `il y a ${diffDays} jours`

  return date.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  })
}

function IndexedRepoCardSkeleton() {
  return (
    <div className="p-3 rounded-lg border border-border bg-card">
      <div className="flex items-center gap-2">
        <Skeleton className="h-4 w-4 rounded" />
        <Skeleton className="h-4 w-32" />
      </div>
      <div className="flex gap-3 mt-2">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-3 w-16" />
      </div>
    </div>
  )
}

export function IndexedReposSection() {
  const router = useRouter()
  const { data: indexedRepos, isLoading } = useIndexedRepos()
  const { data: activeRepo } = useActiveRepo()
  const activateRepo = useActivateRepo()

  const handleRepoClick = async (repoId: string, fullName: string) => {
    try {
      await activateRepo.mutateAsync(repoId)
      toast.success(`${fullName} selectionne`)
      router.push('/chat')
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Impossible de selectionner le repository'
      )
    }
  }

  // Don't show section if no indexed repos
  if (!isLoading && (!indexedRepos || indexedRepos.length === 0)) {
    return null
  }

  return (
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-3">
        <Database className="h-4 w-4 text-green-500" />
        <h2 className="text-sm font-medium text-muted-foreground">
          Repositories indexes
        </h2>
      </div>

      {isLoading ? (
        <div className="grid gap-2">
          <IndexedRepoCardSkeleton />
          <IndexedRepoCardSkeleton />
        </div>
      ) : (
        <div className="grid gap-2">
          {indexedRepos?.map((repo) => (
            <button
              key={repo.id}
              onClick={() => handleRepoClick(repo.id, repo.full_name)}
              disabled={activateRepo.isPending}
              className={cn(
                'w-full text-left p-3 rounded-lg border bg-card',
                'transition-all duration-200 ease-out',
                'border-green-500/30 hover:border-green-500/50',
                'hover:shadow-[0_0_15px_-5px_rgba(34,197,94,0.3)]',
                'focus:outline-none focus:ring-2 focus:ring-green-500/50',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-foreground text-sm truncate">
                    {repo.full_name}
                  </span>
                  <div className="flex items-center gap-2">
                    {activeRepo?.id === repo.id && (
                      <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-pink-500/20 text-pink-500">
                        Actif
                      </span>
                    )}
                    <div className="flex items-center gap-1 text-xs text-green-500">
                      {activateRepo.isPending ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Database className="h-3 w-3" />
                      )}
                      <span>{activateRepo.isPending ? 'Selection...' : 'Indexe'}</span>
                    </div>
                  </div>
                </div>

              <div className="flex items-center gap-4 mt-1.5 text-xs text-muted-foreground">
                {repo.indexing?.completedAt && (
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    <span>{formatRelativeDate(repo.indexing.completedAt)}</span>
                  </div>
                )}
                {repo.indexing?.lastIndexedCommitShort && (
                  <a
                    href={`https://github.com/${repo.full_name}/commit/${repo.indexing.lastIndexedCommitSha}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-center gap-1 hover:text-foreground transition-colors"
                  >
                    <GitCommit className="h-3 w-3" />
                    <span className="font-mono">{repo.indexing.lastIndexedCommitShort}</span>
                    <ExternalLink className="h-2.5 w-2.5" />
                  </a>
                )}
                {repo.indexing?.chunksCreated && repo.indexing.chunksCreated > 0 && (
                  <span>{repo.indexing.chunksCreated} chunks</span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
