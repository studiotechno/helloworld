'use client'

import { useState } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Loader2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

interface DeleteConversationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  conversationTitle: string
  onDelete: () => Promise<void>
}

export function DeleteConversationDialog({
  open,
  onOpenChange,
  conversationTitle,
  onDelete,
}: DeleteConversationDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      await onDelete()
      toast.success('Conversation supprimee')
      onOpenChange(false)
    } catch (error) {
      console.error('[DeleteConversationDialog] Delete error:', error)
      toast.error(
        error instanceof Error
          ? error.message
          : 'Échec de la suppression. Veuillez réessayer.'
      )
    } finally {
      setIsDeleting(false)
    }
  }

  const handleOpenChange = (isOpen: boolean) => {
    if (!isDeleting) {
      onOpenChange(isOpen)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Trash2 className="size-5 text-destructive" />
            Supprimer cette conversation ?
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2 pt-2 text-sm text-muted-foreground">
              <p>
                Vous allez supprimer{' '}
                <strong className="text-foreground">{conversationTitle}</strong>.
              </p>
              <p>
                Cette action est irreversible. Tous les messages seront definitivement supprimes.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>
            Annuler
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={isDeleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isDeleting ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Suppression...
              </>
            ) : (
              'Supprimer'
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
