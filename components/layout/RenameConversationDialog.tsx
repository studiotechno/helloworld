'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Pencil } from 'lucide-react'

interface RenameConversationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  conversationTitle: string
  onRename: (newTitle: string) => void
}

export function RenameConversationDialog({
  open,
  onOpenChange,
  conversationTitle,
  onRename,
}: RenameConversationDialogProps) {
  const [value, setValue] = useState(conversationTitle)

  // Reset value when dialog opens with new title
  useEffect(() => {
    if (open) {
      setValue(conversationTitle)
    }
  }, [open, conversationTitle])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmedValue = value.trim()
    if (trimmedValue && trimmedValue !== conversationTitle) {
      onRename(trimmedValue)
    }
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="size-5 text-primary" />
            Renommer la conversation
          </DialogTitle>
          <DialogDescription>
            Entrez un nouveau nom pour cette conversation.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="py-4">
            <Input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Nom de la conversation"
              maxLength={200}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={!value.trim()}>
              Renommer
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
