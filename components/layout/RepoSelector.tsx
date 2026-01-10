'use client'

import { useRouter } from 'next/navigation'
import { GitBranch, ChevronDown, FolderGit2, ArrowRightLeft } from 'lucide-react'
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

interface RepoSelectorProps {
  repo: ConnectedRepository | null
  isLoading?: boolean
  className?: string
}

export function RepoSelector({ repo, isLoading, className }: RepoSelectorProps) {
  const router = useRouter()

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
          <span className="flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
            <GitBranch className="size-3" />
            {repo.default_branch}
          </span>
          <ChevronDown className="size-4 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <div className="px-2 py-1.5">
          <p className="text-sm font-medium">{repo.full_name}</p>
          <p className="text-xs text-muted-foreground">
            Branche: {repo.default_branch}
          </p>
        </div>
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
