'use client'

import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { REPO_SIZE_WARNING_THRESHOLD_KB } from '@/lib/github/client'

interface SizeWarningDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  repoName: string
  sizeKB: number
  onConfirm: () => void
  onCancel: () => void
  isLoading?: boolean
}

export function SizeWarningDialog({
  open,
  onOpenChange,
  repoName,
  sizeKB,
  onConfirm,
  onCancel,
  isLoading = false,
}: SizeWarningDialogProps) {
  const handleCancel = () => {
    onCancel()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-yellow-500/10">
            <AlertTriangle className="h-6 w-6 text-yellow-500" />
          </div>
          <DialogTitle className="text-center">Repository volumineux</DialogTitle>
          <DialogDescription className="text-center">
            <span className="font-medium text-foreground">{repoName}</span> depasse la
            limite recommandee pour le MVP.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg bg-muted/50 p-4 text-sm">
          <div className="mb-2 flex justify-between">
            <span className="text-muted-foreground">Taille du repository</span>
            <span className="font-medium">{Math.round(sizeKB)} KB</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Limite recommandee</span>
            <span className="font-medium">{REPO_SIZE_WARNING_THRESHOLD_KB} KB</span>
          </div>
          <p className="mt-3 text-muted-foreground">
            Les analyses sur ce repository peuvent prendre plus de temps et les
            performances peuvent être affectées.
          </p>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleCancel} disabled={isLoading}>
            Annuler
          </Button>
          <Button onClick={onConfirm} disabled={isLoading}>
            {isLoading ? 'Connexion...' : 'Continuer quand même'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
