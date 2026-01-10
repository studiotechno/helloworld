'use client'

import { useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getConversationEmoji } from '@/lib/utils/date-groups'
import type { Conversation } from '@/hooks/use-conversations'

interface ConversationItemProps {
  conversation: Conversation
  isCollapsed: boolean
  onDeleteClick: (conversation: Conversation) => void
}

export function ConversationItem({
  conversation,
  isCollapsed,
  onDeleteClick,
}: ConversationItemProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [isHovered, setIsHovered] = useState(false)

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
    <div
      className="group relative"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            onClick={handleClick}
            className={cn(
              'w-full justify-start gap-2 rounded-lg px-3 py-2 text-left pr-10',
              isActive && 'bg-accent text-accent-foreground'
            )}
          >
            <span className="shrink-0 text-base">{emoji}</span>
            <span className="truncate text-sm">{title}</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="right" className="max-w-[300px]">
          <p className="break-words">{title}</p>
        </TooltipContent>
      </Tooltip>

      {/* Delete button - appears on hover */}
      <Button
        variant="ghost"
        size="icon"
        onClick={handleDeleteClick}
        className={cn(
          'absolute right-1 top-1/2 -translate-y-1/2 size-7 rounded-md opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive',
          isHovered && 'opacity-100'
        )}
        aria-label={`Supprimer la conversation "${title}"`}
      >
        <Trash2 className="size-4" />
      </Button>
    </div>
  )
}
