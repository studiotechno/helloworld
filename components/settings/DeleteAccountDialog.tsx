'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
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
import { AlertTriangle, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface DeleteAccountDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const CONFIRMATION_WORD = 'SUPPRIMER'

export function DeleteAccountDialog({ open, onOpenChange }: DeleteAccountDialogProps) {
  const [confirmationInput, setConfirmationInput] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)
  const router = useRouter()

  const isConfirmationValid = confirmationInput === CONFIRMATION_WORD

  const handleDelete = async () => {
    if (!isConfirmationValid) return

    setIsDeleting(true)
    try {
      const response = await fetch('/api/account/delete', {
        method: 'DELETE',
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error?.message || 'Échec de la suppression')
      }

      toast.success('Compte supprimé avec succès')
      router.push('/login')
      router.refresh()
    } catch (error) {
      console.error('[Settings] Delete account error:', error)
      toast.error(
        error instanceof Error
          ? error.message
          : 'Échec de la suppression. Veuillez réessayer.'
      )
      setIsDeleting(false)
    }
  }

  const handleClose = (isOpen: boolean) => {
    if (!isDeleting) {
      setConfirmationInput('')
      onOpenChange(isOpen)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="size-5" />
            Supprimer votre compte
          </DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-2 pt-2 text-sm text-muted-foreground">
              <p>
                Cette action est <strong className="text-destructive">irréversible</strong>.
                Toutes vos données seront définitivement supprimées :
              </p>
              <ul className="ml-4 list-disc space-y-1">
                <li>Votre profil utilisateur</li>
                <li>Vos repositories connectés</li>
                <li>Toutes vos conversations et messages</li>
              </ul>
            </div>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3">
            <p className="text-sm text-muted-foreground">
              Pour confirmer, tapez{' '}
              <code className="rounded bg-destructive/20 px-1.5 py-0.5 font-mono text-destructive">
                {CONFIRMATION_WORD}
              </code>{' '}
              ci-dessous :
            </p>
          </div>

          <Input
            value={confirmationInput}
            onChange={(e) => setConfirmationInput(e.target.value)}
            placeholder={CONFIRMATION_WORD}
            disabled={isDeleting}
            className="font-mono"
            autoComplete="off"
            data-testid="confirmation-input"
          />
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => handleClose(false)}
            disabled={isDeleting}
          >
            Annuler
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={!isConfirmationValid || isDeleting}
            data-testid="confirm-delete-button"
          >
            {isDeleting ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Suppression...
              </>
            ) : (
              'Supprimer définitivement'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
