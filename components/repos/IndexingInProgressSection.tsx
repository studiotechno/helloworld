'use client'

import { Loader2, Download, FileCode, Cpu, Database, Sparkles } from 'lucide-react'
import { Progress } from '@/components/ui/progress'
import { useIndexingRepos } from '@/hooks/useIndexingRepos'
import { getPhaseColor } from '@/hooks/useIndexingStatus'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

// Phase icons and labels
const phaseConfig: Record<string, { icon: typeof Loader2; label: string }> = {
  'Fetching files': { icon: Download, label: 'Recuperation des fichiers' },
  'Parsing code': { icon: FileCode, label: 'Analyse du code' },
  'Generating context': { icon: Sparkles, label: 'Generation du contexte' },
  'Generating embeddings': { icon: Cpu, label: 'Generation des embeddings' },
  'Finalizing': { icon: Database, label: 'Finalisation' },
  'Initializing': { icon: Loader2, label: 'Initialisation' },
}

function IndexingRepoCardSkeleton() {
  return (
    <div className="p-4 rounded-lg border border-pink-500/30 bg-card">
      <div className="flex items-center gap-2">
        <Skeleton className="h-4 w-4 rounded" />
        <Skeleton className="h-4 w-40" />
      </div>
      <div className="mt-3">
        <Skeleton className="h-2 w-full rounded-full" />
      </div>
      <div className="flex justify-between mt-2">
        <Skeleton className="h-3 w-8" />
        <Skeleton className="h-3 w-20" />
      </div>
    </div>
  )
}

export function IndexingInProgressSection() {
  const { data: indexingRepos, isLoading } = useIndexingRepos()

  // Don't show section if no repos are being indexed
  if (!isLoading && (!indexingRepos || indexingRepos.length === 0)) {
    return null
  }

  return (
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-3">
        <Loader2 className="h-4 w-4 text-pink-500 animate-spin" />
        <h2 className="text-sm font-medium text-muted-foreground">
          Indexation en cours
        </h2>
      </div>

      {isLoading ? (
        <div className="grid gap-3">
          <IndexingRepoCardSkeleton />
        </div>
      ) : (
        <div className="grid gap-3">
          {indexingRepos?.map((repo) => {
            const progress = repo.indexing.progress || 0
            const currentPhase = repo.indexing.currentPhase || 'Initializing'
            const PhaseIcon = phaseConfig[currentPhase]?.icon || Loader2
            const phaseLabel = phaseConfig[currentPhase]?.label || currentPhase
            const phaseColor = getPhaseColor(currentPhase)

            return (
              <div
                key={repo.id}
                className={cn(
                  "p-4 rounded-lg border bg-card transition-all duration-300",
                  phaseColor.border,
                  phaseColor.glow
                )}
              >
                {/* Header: repo name */}
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className="font-medium text-foreground text-sm truncate">
                    {repo.full_name}
                  </span>
                  <div className={cn("flex items-center gap-1.5", phaseColor.text)}>
                    <PhaseIcon className="h-4 w-4 animate-spin" />
                    <span className="text-xs font-medium">{phaseLabel}</span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="space-y-1.5">
                  <Progress
                    value={progress}
                    className="h-2"
                    indicatorClassName={phaseColor.bg}
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span className={cn("font-medium", phaseColor.text)}>{progress}%</span>
                    {repo.indexing.filesTotal !== null && repo.indexing.filesProcessed !== null && (
                      <span>
                        {repo.indexing.filesProcessed} / {repo.indexing.filesTotal} fichiers
                      </span>
                    )}
                  </div>
                </div>

                {/* Chunks info */}
                {repo.indexing.chunksCreated > 0 && (
                  <p className="text-xs text-muted-foreground mt-2">
                    {repo.indexing.chunksCreated} sections creees
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
