'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Trash2, Pencil, Check, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getConversationEmoji } from '@/lib/utils/date-groups'
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
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const isActive = pathname === `/chat/${conversation.id}`
  const title = conversation.title || 'Sans titre'
  const emoji = getConversationEmoji(conversation.title)

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditing])

  const handleClick = () => {
    if (!isEditing) {
      router.push(`/chat/${conversation.id}`)
    }
  }

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    onDeleteClick(conversation)
  }

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    setEditValue(title)
    setIsEditing(true)
  }

  const handleSave = () => {
    const trimmedValue = editValue.trim()
    if (trimmedValue && trimmedValue !== title) {
      onRename(conversation.id, trimmedValue)
    }
    setIsEditing(false)
  }

  const handleCancel = () => {
    setIsEditing(false)
    setEditValue('')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSave()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      handleCancel()
    }
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
    <div className="group relative">
      {isEditing ? (
        // Edit mode
        <div className="flex items-center gap-1 rounded-lg bg-accent px-2 py-1.5">
          <span className="shrink-0 text-base">{emoji}</span>
          <input
            ref={inputRef}
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleSave}
            className="flex-1 bg-transparent text-sm outline-none"
            maxLength={200}
          />
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation()
              handleSave()
            }}
            className="size-6 shrink-0 hover:bg-primary/20 hover:text-primary"
          >
            <Check className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation()
              handleCancel()
            }}
            className="size-6 shrink-0 hover:bg-destructive/20 hover:text-destructive"
          >
            <X className="size-3.5" />
          </Button>
        </div>
      ) : (
        // View mode - use flex container for proper button positioning
        <div className="flex items-center w-full">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                onClick={handleClick}
                className={cn(
                  'flex-1 min-w-0 justify-start gap-2 rounded-lg px-3 py-2 text-left',
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

          {/* Action buttons - visible on hover */}
          <div className="shrink-0 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleEditClick}
              className="size-7 rounded-md hover:bg-muted"
              aria-label={`Renommer la conversation "${title}"`}
            >
              <Pencil className="size-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleDeleteClick}
              className="size-7 rounded-md hover:bg-destructive/10 hover:text-destructive"
              aria-label={`Supprimer la conversation "${title}"`}
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
