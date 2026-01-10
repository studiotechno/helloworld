'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  MessageSquarePlus,
  PanelLeftClose,
  PanelLeft,
  MessageSquare,
  Sparkles,
  FolderGit2,
  Loader2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useConversations, useDeleteConversation, type Conversation } from '@/hooks/use-conversations'
import { groupConversationsByDate, DATE_GROUP_LABELS, DATE_GROUP_ORDER } from '@/lib/utils/date-groups'
import { ConversationItem } from './ConversationItem'
import { DeleteConversationDialog } from './DeleteConversationDialog'

const APP_VERSION = '3.8'

interface SidebarProps {
  isCollapsed: boolean
  onToggle: () => void
}

export function Sidebar({ isCollapsed, onToggle }: SidebarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { data: conversations, isLoading: conversationsLoading } = useConversations()
  const deleteConversation = useDeleteConversation()

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
              <Sparkles className="size-5 text-primary" />
              <span className="text-lg font-semibold">techno</span>
            </div>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
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
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>{isCollapsed ? 'Développer' : 'Réduire'} (⌘+B)</p>
            </TooltipContent>
          </Tooltip>
        </div>

        {/* New Conversation Button */}
        <div className="p-3 space-y-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={() => router.push('/chat')}
                className={cn(
                  'w-full gap-2 rounded-xl bg-primary text-primary-foreground shadow-[var(--glow-pink)] transition-shadow hover:shadow-[0_0_30px_oklch(0.656_0.241_354.308_/_60%)]',
                  isCollapsed && 'justify-center px-2'
                )}
              >
                <MessageSquarePlus className="size-4 shrink-0" />
                {!isCollapsed && <span>Nouvelle conversation</span>}
              </Button>
            </TooltipTrigger>
            <TooltipContent side={isCollapsed ? 'right' : 'bottom'}>
              <p>Nouvelle conversation (⌘+N)</p>
            </TooltipContent>
          </Tooltip>

          {/* Select Repository Button */}
          <Tooltip>
            <TooltipTrigger asChild>
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
            </TooltipTrigger>
            {isCollapsed && (
              <TooltipContent side="right">
                <p>Repositories</p>
              </TooltipContent>
            )}
          </Tooltip>
        </div>

        <Separator className="opacity-50" />

        {/* Conversation List */}
        <ScrollArea className="flex-1">
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
                        <p className="px-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                          {DATE_GROUP_LABELS[group]}
                        </p>
                        <div className="space-y-1">
                          {groupConversations.map((conversation) => (
                            <ConversationItem
                              key={conversation.id}
                              conversation={conversation}
                              isCollapsed={false}
                              onDeleteClick={handleDeleteClick}
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
                    />
                  ))
                ) : (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex size-10 items-center justify-center rounded-lg text-muted-foreground">
                        <MessageSquare className="size-4" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      <p>Aucune conversation</p>
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Footer with keyboard hint and version */}
        {!isCollapsed && (
          <div className="shrink-0 border-t border-border/50 p-3 space-y-1">
            <p className="text-center text-xs text-muted-foreground/70">
              <kbd className="rounded border border-border/50 bg-muted/50 px-1.5 py-0.5 font-mono text-[10px]">
                ⌘+B
              </kbd>
              {' '}pour réduire
            </p>
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
