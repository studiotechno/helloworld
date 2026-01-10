'use client'

import { AlertCircle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface RepoErrorProps {
  message: string
  onRetry: () => void
  className?: string
}

export function RepoError({ message, onRetry, className }: RepoErrorProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center p-8 text-center',
        className
      )}
      role="alert"
    >
      <div className="rounded-full bg-destructive/10 p-3 mb-4">
        <AlertCircle className="h-6 w-6 text-destructive" />
      </div>
      <h3 className="text-lg font-medium text-foreground mb-2">
        Erreur de chargement
      </h3>
      <p className="text-sm text-muted-foreground mb-6 max-w-sm">{message}</p>
      <Button
        onClick={onRetry}
        variant="outline"
        className="gap-2"
      >
        <RefreshCw className="h-4 w-4" />
        Reessayer
      </Button>
    </div>
  )
}
