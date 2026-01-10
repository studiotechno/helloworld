'use client'

import { Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { UserMenu } from './UserMenu'
import { RepoSelector } from './RepoSelector'
import { TechTags } from './TechTags'
import type { ConnectedRepository } from '@/hooks/useConnectRepo'

interface TopBarProps {
  user: {
    name: string
    email?: string | null
    avatarUrl?: string | null
  }
  onMenuClick?: () => void
  showMenuButton?: boolean
  repo?: ConnectedRepository | null
  repoLoading?: boolean
  technologies?: string[]
}

export function TopBar({
  user,
  onMenuClick,
  showMenuButton = false,
  repo,
  repoLoading,
  technologies,
}: TopBarProps) {
  return (
    <header className="sticky top-0 z-40 flex h-16 shrink-0 items-center justify-between border-b border-border/50 bg-background/80 px-4 backdrop-blur-sm md:px-6">
      <div className="flex items-center gap-4">
        {/* Mobile menu button */}
        {showMenuButton && (
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={onMenuClick}
            aria-label="Ouvrir le menu"
          >
            <Menu className="size-5" />
          </Button>
        )}

        {/* Repository selector */}
        <RepoSelector repo={repo ?? null} isLoading={repoLoading} />

        {/* Technology tags - hidden on mobile */}
        {technologies && technologies.length > 0 && (
          <TechTags
            technologies={technologies}
            maxVisible={3}
            className="hidden lg:flex"
          />
        )}
      </div>

      <div className="flex items-center gap-4">
        <UserMenu user={user} />
      </div>
    </header>
  )
}
