'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
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
import { Loader2, Unplug } from 'lucide-react'
import { toast } from 'sonner'

interface DisconnectRepoDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  repoName: string
  onDisconnect: () => Promise<unknown>
}

export function DisconnectRepoDialog({
  open,
  onOpenChange,
  repoName,
  onDisconnect,
}: DisconnectRepoDialogProps) {
  const [isDisconnecting, setIsDisconnecting] = useState(false)
  const router = useRouter()

  const handleDisconnect = async () => {
    setIsDisconnecting(true)
    try {
      await onDisconnect()
      toast.success('Repository deconnecte')
      onOpenChange(false)
      router.push('/repos')
    } catch (error) {
      console.error('[Settings] Disconnect repo error:', error)
      toast.error(
        error instanceof Error
          ? error.message
          : 'Echec de la deconnexion. Veuillez reessayer.'
      )
      setIsDisconnecting(false)
    }
  }

  const handleOpenChange = (isOpen: boolean) => {
    if (!isDisconnecting) {
      onOpenChange(isOpen)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Unplug className="size-5 text-destructive" />
            Deconnecter le repository ?
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2 pt-2 text-sm text-muted-foreground">
              <p>
                Vous allez deconnecter{' '}
                <strong className="text-foreground">{repoName}</strong>.
              </p>
              <p>
                Vos conversations passees resteront accessibles en lecture seule.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDisconnecting}>
            Annuler
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDisconnect}
            disabled={isDisconnecting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isDisconnecting ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Deconnexion...
              </>
            ) : (
              'Deconnecter'
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
