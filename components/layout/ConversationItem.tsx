'use client'

import { useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Trash2, Pencil, MoreHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getConversationEmoji } from '@/lib/utils/date-groups'
import { RenameConversationDialog } from './RenameConversationDialog'
import type { Conversation } from '@/hooks/use-conversations'

interface ConversationItemProps {
  conversation: Conversation
  isCollapsed: boolean
  onDeleteClick: (conversation: Conversation) => void
  onRename: (conversationId: string, newTitle: string) => void
}

export function ConversationItem({
  conversation,
  isCollapsed,
  onDeleteClick,
  onRename,
}: ConversationItemProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [renameDialogOpen, setRenameDialogOpen] = useState(false)

  const isActive = pathname === `/chat/${conversation.id}`
  const title = conversation.title || 'Sans titre'
  const emoji = getConversationEmoji(conversation.title)

  const handleClick = () => {
    router.push(`/chat/${conversation.id}`)
  }

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    onDeleteClick(conversation)
  }

  const handleRenameClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    setRenameDialogOpen(true)
  }

  const handleRename = (newTitle: string) => {
    onRename(conversation.id, newTitle)
  }

  if (isCollapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleClick}
            className={cn(
              'size-10 rounded-lg',
              isActive && 'bg-accent text-accent-foreground'
            )}
          >
            <span className="text-base">{emoji}</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="right">
          <p className="max-w-[200px] truncate">{title}</p>
        </TooltipContent>
      </Tooltip>
    )
  }

  return (
    <>
      <div className="group relative w-full">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              onClick={handleClick}
              className={cn(
                'w-full justify-start gap-2 rounded-lg px-3 py-2 text-left',
                isActive && 'bg-accent text-accent-foreground'
              )}
            >
              {/* Emoji - hidden on hover */}
              <span className="text-base shrink-0 group-hover:opacity-0 transition-opacity duration-150">
                {emoji}
              </span>
              <span className="truncate text-sm">{title}</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right" className="max-w-[300px]">
            <p className="break-words">{title}</p>
          </TooltipContent>
        </Tooltip>

        {/* 3 dots menu - positioned absolutely, visible on hover */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              onClick={(e) => e.stopPropagation()}
              className="absolute left-3 top-1/2 -translate-y-1/2 size-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-150 hover:bg-muted rounded"
              aria-label="Options de la conversation"
            >
              <MoreHorizontal className="size-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side="right" className="w-40">
            <DropdownMenuItem onClick={handleRenameClick}>
              <Pencil className="size-4 mr-2" />
              Renommer
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={handleDeleteClick}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="size-4 mr-2" />
              Supprimer
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <RenameConversationDialog
        open={renameDialogOpen}
        onOpenChange={setRenameDialogOpen}
        conversationTitle={title}
        onRename={handleRename}
      />
    </>
  )
}
