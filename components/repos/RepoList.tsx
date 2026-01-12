'use client'

import { useState, useMemo, useCallback } from 'react'
import { Search, FolderGit2, RefreshCw } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { RepoCard } from './RepoCard'
import { RepoError } from './RepoError'
import { useRepos, useActiveRepo, useIndexedRepos } from '@/hooks'
import { cn } from '@/lib/utils'

interface RepoListProps {
  onSelectRepo?: (repoId: number, fullName: string) => void
  className?: string
}


function RepoCardSkeleton() {
  return (
    <div className="p-4 rounded-lg border border-border bg-card">
      <div className="flex items-center gap-2">
        <Skeleton className="h-4 w-4 rounded" />
        <Skeleton className="h-4 w-48" />
      </div>
      <Skeleton className="h-4 w-full mt-2" />
      <Skeleton className="h-4 w-3/4 mt-1" />
      <div className="flex gap-4 mt-3">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-3 w-24 ml-auto" />
      </div>
    </div>
  )
}

function EmptyState({ hasSearch }: { hasSearch: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="rounded-full bg-muted p-4 mb-4">
        <FolderGit2 className="h-8 w-8 text-muted-foreground" />
      </div>
      {hasSearch ? (
        <>
          <h3 className="text-lg font-medium text-foreground mb-2">
            Aucun resultat
          </h3>
          <p className="text-sm text-muted-foreground max-w-sm">
            Aucun repository ne correspond a votre recherche. Essayez avec d&apos;autres termes.
          </p>
        </>
      ) : (
        <>
          <h3 className="text-lg font-medium text-foreground mb-2">
            Aucun repository
          </h3>
          <p className="text-sm text-muted-foreground max-w-sm">
            Vous n&apos;avez pas encore de repositories accessibles sur GitHub.
          </p>
        </>
      )}
    </div>
  )
}

export function RepoList({ onSelectRepo, className }: RepoListProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const { data: repos, isLoading, error, refetch, forceRefresh, isRefreshing } = useRepos()
  const { data: activeRepo } = useActiveRepo()
  const { data: indexedRepos } = useIndexedRepos()

  // Get set of indexed repo GitHub IDs for quick lookup
  const indexedRepoIds = useMemo(() => {
    if (!indexedRepos) return new Set<string>()
    return new Set(indexedRepos.map((r) => r.github_repo_id))
  }, [indexedRepos])

  // Filter repos based on search query and exclude indexed repos
  const filteredRepos = useMemo(() => {
    if (!repos) return []

    // First filter out indexed repos
    const nonIndexedRepos = repos.filter(
      (repo) => !indexedRepoIds.has(String(repo.id))
    )

    if (!searchQuery.trim()) return nonIndexedRepos

    const query = searchQuery.toLowerCase()
    return nonIndexedRepos.filter(
      (repo) =>
        repo.full_name.toLowerCase().includes(query) ||
        (repo.description?.toLowerCase().includes(query) ?? false)
    )
  }, [repos, searchQuery, indexedRepoIds])

  const handleRetry = useCallback(() => {
    refetch()
  }, [refetch])

  const handleRepoClick = useCallback(
    (repoId: number, fullName: string) => {
      onSelectRepo?.(repoId, fullName)
    },
    [onSelectRepo]
  )

  return (
    <div className={cn('space-y-4', className)}>
      {/* Search input with refresh button */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Rechercher un repository..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            aria-label="Rechercher un repository"
          />
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={forceRefresh}
          disabled={isRefreshing || isLoading}
          title="Rafraîchir la liste (inclut les repos d'organisations)"
        >
          <RefreshCw className={cn('h-4 w-4', isRefreshing && 'animate-spin')} />
        </Button>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="space-y-3">
          <RepoCardSkeleton />
          <RepoCardSkeleton />
          <RepoCardSkeleton />
          <RepoCardSkeleton />
        </div>
      )}

      {/* Error state */}
      {error && !isLoading && (
        <RepoError
          message={error instanceof Error ? error.message : 'Une erreur est survenue'}
          onRetry={handleRetry}
        />
      )}

      {/* Repo list */}
      {!isLoading && !error && (
        <>
          {filteredRepos.length === 0 ? (
            <EmptyState hasSearch={searchQuery.trim().length > 0} />
          ) : (
            <div className="space-y-3">
              {filteredRepos.map((repo) => (
                <RepoCard
                  key={repo.id}
                  repo={repo}
                  isActive={activeRepo?.github_repo_id === String(repo.id)}
                  onClick={() => handleRepoClick(repo.id, repo.full_name)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Results count */}
      {/* {!isLoading && !error && repos && repos.length > 0 && (
        <p className="text-xs text-muted-foreground text-center pt-2">
          {filteredRepos.length} repositories disponibles
          {searchQuery.trim() && ` (recherche)`}
        </p>
      )} */}
    </div>
  )
}
