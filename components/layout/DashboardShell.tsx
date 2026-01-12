'use client'

import { useState, useCallback } from 'react'
import { TooltipProvider } from '@/components/ui/tooltip'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import { Sparkles, FolderGit2, BookOpen } from 'lucide-react'
import { useActiveRepo } from '@/hooks/useActiveRepo'
import { useRepoTechnologies } from '@/hooks/useRepoTechnologies'
import { useNewConversationShortcut } from '@/hooks/use-keyboard-shortcuts'

interface DashboardShellProps {
  user: {
    name: string
    email?: string | null
    avatarUrl?: string | null
  }
  children: React.ReactNode
}

export function DashboardShell({ user, children }: DashboardShellProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false)
  const { data: activeRepo, isLoading: repoLoading } = useActiveRepo()
  // Only fetch technologies when we have an active repo
  const { data: technologies } = useRepoTechnologies(!!activeRepo)

  // Global keyboard shortcut: ⌘+N for new conversation
  useNewConversationShortcut()

  const handleToggleSidebar = useCallback(() => {
    setSidebarCollapsed((prev) => !prev)
  }, [])

  const handleMobileMenuClick = useCallback(() => {
    setMobileSheetOpen(true)
  }, [])

  return (
    <TooltipProvider delayDuration={0}>
      <div className="flex h-screen bg-background">
        {/* Desktop Sidebar */}
        <div className="hidden md:block">
          <Sidebar isCollapsed={sidebarCollapsed} onToggle={handleToggleSidebar} />
        </div>

        {/* Mobile Sheet Sidebar */}
        <Sheet open={mobileSheetOpen} onOpenChange={setMobileSheetOpen}>
          <SheetContent
            side="left"
            className="w-[280px] bg-sidebar p-0 sm:max-w-[280px]"
          >
            <SheetHeader className="border-b border-border/50 px-4 py-4">
              <SheetTitle className="flex items-center gap-2">
                <Sparkles className="size-5 text-primary" />
                <span>techno</span>
              </SheetTitle>
            </SheetHeader>
            <MobileSidebarContent onClose={() => setMobileSheetOpen(false)} />
          </SheetContent>
        </Sheet>

        {/* Main Content Area */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <TopBar
            user={user}
            onMenuClick={handleMobileMenuClick}
            showMenuButton
            repo={activeRepo}
            repoLoading={repoLoading}
            technologies={technologies}
          />
          <main className="flex-1 overflow-auto">{children}</main>
        </div>
      </div>
    </TooltipProvider>
  )
}

interface MobileSidebarContentProps {
  onClose: () => void
}

function MobileSidebarContent({ onClose }: MobileSidebarContentProps) {
  return (
    <div className="flex flex-1 flex-col p-4">
      {/* New Conversation Button */}
      <button
        onClick={() => {
          onClose()
          window.location.href = '/chat'
        }}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-medium text-primary-foreground shadow-[var(--glow-pink)] transition-shadow hover:shadow-[0_0_30px_oklch(0.656_0.241_354.308_/_60%)]"
      >
        <span>Nouvelle conversation</span>
      </button>

      {/* Navigation Links */}
      <div className="mt-4 space-y-2">
        <button
          onClick={() => {
            onClose()
            window.location.href = '/repos'
          }}
          className="flex w-full items-center gap-2 rounded-xl border border-border/50 px-4 py-3 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
        >
          <FolderGit2 className="size-4" />
          <span>Repositories</span>
        </button>
        <button
          onClick={() => {
            onClose()
            window.location.href = '/docs'
          }}
          className="flex w-full items-center gap-2 rounded-xl border border-border/50 px-4 py-3 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
        >
          <BookOpen className="size-4" />
          <span>Documentation</span>
        </button>
      </div>

      {/* Conversation List Placeholder */}
      <div className="mt-4">
        <p className="px-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Conversations
        </p>
        <div className="mt-2 rounded-xl border border-dashed border-border/50 p-4 text-center">
          <p className="text-sm text-muted-foreground">Aucune conversation</p>
        </div>
      </div>
    </div>
  )
}
