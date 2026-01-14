'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import {
  SquarePen,
  PanelLeftClose,
  PanelLeft,
  MessageSquare,
  FolderGit2,
  BookOpen,
  Loader2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useConversations, useDeleteConversation, useRenameConversation, type Conversation } from '@/hooks/use-conversations'
import { useActiveRepo } from '@/hooks/useActiveRepo'
import { useIndexingStatus } from '@/hooks/useIndexingStatus'
import { useTokenUsage } from '@/hooks/useTokenUsage'
import { groupConversationsByDate, DATE_GROUP_LABELS, DATE_GROUP_ORDER } from '@/lib/utils/date-groups'
import { ConversationItem } from './ConversationItem'
import { DeleteConversationDialog } from './DeleteConversationDialog'

const APP_VERSION = '0.1'

interface SidebarProps {
  isCollapsed: boolean
  onToggle: () => void
}

export function Sidebar({ isCollapsed, onToggle }: SidebarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { data: activeRepo } = useActiveRepo()
  const { data: conversations, isLoading: conversationsLoading } = useConversations(activeRepo?.id)
  const deleteConversation = useDeleteConversation()
  const renameConversation = useRenameConversation()
  const { isIndexed, isInProgress } = useIndexingStatus(activeRepo?.id)
  const { data: tokenUsage } = useTokenUsage()

  // Calculate total tokens
  const totalTokens = tokenUsage
    ? (tokenUsage.total.input_tokens + tokenUsage.total.output_tokens)
    : 0

  // Can only create new conversation if repo is indexed
  const canCreateConversation = activeRepo && isIndexed && !isInProgress

  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [conversationToDelete, setConversationToDelete] = useState<Conversation | null>(null)

  // Group conversations by date
  const groupedConversations = useMemo(() => {
    if (!conversations) return null
    return groupConversationsByDate(conversations)
  }, [conversations])

  // Keyboard shortcut: ⌘+B to toggle sidebar
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'b') {
        event.preventDefault()
        onToggle()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onToggle])

  const handleDeleteClick = (conversation: Conversation) => {
    setConversationToDelete(conversation)
    setDeleteDialogOpen(true)
  }

  const handleRename = (conversationId: string, newTitle: string) => {
    renameConversation.mutate({ conversationId, title: newTitle })
  }

  const handleDeleteConfirm = async () => {
    if (!conversationToDelete) return

    await deleteConversation.mutateAsync(conversationToDelete.id)

    // Navigate away if we deleted the active conversation
    if (pathname === `/chat/${conversationToDelete.id}`) {
      router.push('/chat')
    }

    setConversationToDelete(null)
  }

  return (
    <>
      <aside
        role="navigation"
        aria-label="Navigation principale"
        className={cn(
          'flex h-full flex-col border-r border-border/50 bg-sidebar transition-all duration-300 ease-in-out',
          isCollapsed ? 'w-16' : 'w-[280px]'
        )}
      >
        {/* Header */}
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-border/50 px-4">
          {!isCollapsed && (
            <div className="flex items-center gap-2">
              <svg className="size-5 text-primary" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="6" cy="12" r="4" fill="currentColor" />
                <circle cx="18" cy="12" r="4" fill="currentColor" />
                <line x1="10" y1="12" x2="14" y2="12" stroke="currentColor" strokeWidth="2" />
              </svg>
              <span className="text-lg font-semibold">onhcet</span>
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggle}
            className={cn('shrink-0', isCollapsed && 'mx-auto')}
            aria-label={isCollapsed ? 'Développer la sidebar' : 'Réduire la sidebar'}
          >
            {isCollapsed ? (
              <PanelLeft className="size-4" />
            ) : (
              <PanelLeftClose className="size-4" />
            )}
          </Button>
        </div>

        {/* New Conversation Button */}
        <div className="p-3 space-y-2">
          <Button
            onClick={() => canCreateConversation && router.push(`/chat?new=${Date.now()}`)}
            disabled={!canCreateConversation}
            className={cn(
              'w-full gap-2 rounded-xl transition-shadow',
              canCreateConversation
                ? 'bg-primary text-primary-foreground shadow-[var(--glow-pink)] hover:shadow-[0_0_30px_oklch(0.656_0.241_354.308_/_60%)]'
                : 'bg-muted text-muted-foreground cursor-not-allowed',
              isCollapsed && 'justify-center px-2'
            )}
          >
            <SquarePen className="size-4 shrink-0" />
            {!isCollapsed && <span>Nouvelle conversation</span>}
          </Button>

          {/* Select Repository Button */}
          <Button
            variant="outline"
            onClick={() => router.push('/repos')}
            className={cn(
              'w-full gap-2 rounded-xl border-border/50 hover:bg-accent hover:text-accent-foreground',
              isCollapsed && 'justify-center px-2'
            )}
          >
            <FolderGit2 className="size-4 shrink-0" />
            {!isCollapsed && <span>Repositories</span>}
          </Button>

          {/* Documentation Button */}
          <Button
            variant="outline"
            onClick={() => router.push('/docs')}
            className={cn(
              'w-full gap-2 rounded-xl border-border/50 hover:bg-accent hover:text-accent-foreground',
              isCollapsed && 'justify-center px-2'
            )}
          >
            <BookOpen className="size-4 shrink-0" />
            {!isCollapsed && <span>Documentation</span>}
          </Button>
        </div>

        <Separator className="opacity-50" />

        {/* Conversation List */}
        <ScrollArea className="flex-1 min-h-0 overflow-hidden">
          <div className="p-3">
            {!isCollapsed ? (
              <div className="space-y-4">
                {conversationsLoading ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="size-5 animate-spin text-muted-foreground" />
                  </div>
                ) : groupedConversations && conversations && conversations.length > 0 ? (
                  DATE_GROUP_ORDER.map((group) => {
                    const groupConversations = groupedConversations.get(group) || []
                    if (groupConversations.length === 0) return null

                    return (
                      <div key={group} className="space-y-1">
                        <p className="px-2 text-xs font-medium text-muted-foreground">
                          {DATE_GROUP_LABELS[group]}
                        </p>
                        <div className="space-y-1">
                          {groupConversations.map((conversation) => (
                            <ConversationItem
                              key={conversation.id}
                              conversation={conversation}
                              isCollapsed={false}
                              onDeleteClick={handleDeleteClick}
                              onRename={handleRename}
                            />
                          ))}
                        </div>
                      </div>
                    )
                  })
                ) : (
                  <div className="rounded-xl border border-dashed border-border/50 p-4 text-center">
                    <MessageSquare className="mx-auto mb-2 size-8 text-muted-foreground/50" />
                    <p className="text-sm text-muted-foreground">
                      Aucune conversation
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                {conversationsLoading ? (
                  <Loader2 className="size-4 animate-spin text-muted-foreground" />
                ) : conversations && conversations.length > 0 ? (
                  conversations.slice(0, 5).map((conversation) => (
                    <ConversationItem
                      key={conversation.id}
                      conversation={conversation}
                      isCollapsed={true}
                      onDeleteClick={handleDeleteClick}
                      onRename={handleRename}
                    />
                  ))
                ) : (
                  <div className="flex size-10 items-center justify-center rounded-lg text-muted-foreground">
                    <MessageSquare className="size-4" />
                  </div>
                )}
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Footer with tokens and version */}
        {!isCollapsed && (
          <div className="shrink-0 border-t border-border/50 p-3 space-y-2">
            <button
              onClick={() => router.push('/settings#usage')}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-muted/50 px-3 py-2 transition-colors hover:bg-muted"
            >
              <span className="font-semibold tabular-nums text-foreground">
                {totalTokens.toLocaleString('fr-FR')}
              </span>
              <span className="text-xs text-muted-foreground">tokens</span>
            </button>
            <p className="text-center text-[10px] text-muted-foreground/50">
              v{APP_VERSION}
            </p>
          </div>
        )}
      </aside>

      {/* Delete Confirmation Dialog */}
      <DeleteConversationDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        conversationTitle={conversationToDelete?.title || 'Sans titre'}
        onDelete={handleDeleteConfirm}
      />
    </>
  )
}
