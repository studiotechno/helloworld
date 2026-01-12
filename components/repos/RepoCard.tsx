'use client'

import { GitFork, Star, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { GitHubRepo } from '@/lib/github/types'
import { IndexingBadge } from './IndexingProgress'
import { useIndexingStatus } from '@/hooks/useIndexingStatus'

interface RepoCardProps {
  repo: GitHubRepo
  onClick?: () => void
  isActive?: boolean
  className?: string
  /** Optional repository ID for showing indexing status */
  repositoryId?: string
  /** Whether to show indexing status badge (default: true when repositoryId provided) */
  showIndexingStatus?: boolean
}

// Language color mapping (matches GitHub's language colors)
const languageColors: Record<string, string> = {
  TypeScript: 'bg-blue-500',
  JavaScript: 'bg-yellow-400',
  Python: 'bg-green-500',
  Go: 'bg-cyan-500',
  Rust: 'bg-orange-500',
  Java: 'bg-red-500',
  Ruby: 'bg-red-600',
  PHP: 'bg-purple-500',
  'C#': 'bg-purple-600',
  C: 'bg-gray-500',
  'C++': 'bg-pink-500',
  Swift: 'bg-orange-400',
  Kotlin: 'bg-purple-400',
  Dart: 'bg-cyan-400',
  Vue: 'bg-emerald-500',
  HTML: 'bg-orange-600',
  CSS: 'bg-indigo-500',
  Shell: 'bg-green-600',
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)

  if (diffInSeconds < 60) return 'il y a quelques secondes'
  if (diffInSeconds < 3600) {
    const minutes = Math.floor(diffInSeconds / 60)
    return `il y a ${minutes} minute${minutes > 1 ? 's' : ''}`
  }
  if (diffInSeconds < 86400) {
    const hours = Math.floor(diffInSeconds / 3600)
    return `il y a ${hours} heure${hours > 1 ? 's' : ''}`
  }
  if (diffInSeconds < 2592000) {
    const days = Math.floor(diffInSeconds / 86400)
    return `il y a ${days} jour${days > 1 ? 's' : ''}`
  }
  if (diffInSeconds < 31536000) {
    const months = Math.floor(diffInSeconds / 2592000)
    return `il y a ${months} mois`
  }
  const years = Math.floor(diffInSeconds / 31536000)
  return `il y a ${years} an${years > 1 ? 's' : ''}`
}

export function RepoCard({
  repo,
  onClick,
  isActive,
  className,
  repositoryId,
  showIndexingStatus = true,
}: RepoCardProps) {
  const languageColor = repo.language ? languageColors[repo.language] || 'bg-gray-400' : null

  // Fetch indexing status if repositoryId is provided
  const { status, isLoading: isLoadingStatus } = useIndexingStatus(
    showIndexingStatus ? repositoryId : null,
    { enablePolling: true }
  )

  const shouldShowIndexingBadge = showIndexingStatus && repositoryId && !isLoadingStatus

  return (
    <button
      onClick={isActive ? undefined : onClick}
      disabled={isActive}
      className={cn(
        'w-full text-left p-4 rounded-lg border bg-card',
        'transition-all duration-200 ease-out',
        isActive
          ? 'border-pink-500 cursor-default opacity-90'
          : [
              'border-border',
              'hover:border-pink-500/50 hover:shadow-[0_0_20px_-5px_rgba(236,72,153,0.3)]',
              'hover:scale-[1.01]',
            ],
        'focus:outline-none focus:ring-2 focus:ring-pink-500/50 focus:ring-offset-2 focus:ring-offset-background',
        className
      )}
      type="button"
    >
      {/* Header: repo name and badges */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <GitFork className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <span className="font-medium text-foreground truncate">{repo.full_name}</span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {shouldShowIndexingBadge && (
            <IndexingBadge status={status} />
          )}
          {isActive && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-pink-500/20 text-pink-500 font-medium">
              Connecte
            </span>
          )}
          {repo.private && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
              Prive
            </span>
          )}
        </div>
      </div>

      {/* Description */}
      {repo.description && (
        <p className="mt-2 text-sm text-muted-foreground line-clamp-2">{repo.description}</p>
      )}

      {/* Footer: language, stars, last updated */}
      <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
        {repo.language && (
          <div className="flex items-center gap-1.5">
            <span className={cn('w-2.5 h-2.5 rounded-full', languageColor)} />
            <span>{repo.language}</span>
          </div>
        )}

        {repo.stargazers_count > 0 && (
          <div className="flex items-center gap-1">
            <Star className="h-3.5 w-3.5" />
            <span>{repo.stargazers_count}</span>
          </div>
        )}

        <div className="flex items-center gap-1 ml-auto">
          <Clock className="h-3.5 w-3.5" />
          <span>{formatRelativeTime(repo.pushed_at)}</span>
        </div>
      </div>
    </button>
  )
}
