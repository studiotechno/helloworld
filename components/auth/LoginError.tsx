'use client'

import { AlertCircle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface LoginErrorProps {
  error: string
  description?: string
}

const errorMessages: Record<string, string> = {
  access_denied: "Vous avez refusé l'accès à l'application GitHub.",
  server_error: 'Une erreur serveur est survenue. Veuillez réessayer.',
  temporarily_unavailable: 'Le service est temporairement indisponible.',
  default: "Une erreur est survenue lors de la connexion.",
}

export function LoginError({ error, description }: LoginErrorProps) {
  const message = errorMessages[error] || description || errorMessages.default

  const handleRetry = () => {
    // Clear error params and reload
    window.location.href = '/login'
  }

  return (
    <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4">
      <div className="flex items-start gap-3">
        <AlertCircle className="mt-0.5 size-5 shrink-0 text-destructive" />
        <div className="flex-1 space-y-3">
          <div>
            <p className="font-medium text-destructive">Échec de la connexion</p>
            <p className="mt-1 text-sm text-muted-foreground">{message}</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRetry}
            className="gap-2"
          >
            <RefreshCw className="size-4" />
            Réessayer
          </Button>
        </div>
      </div>
    </div>
  )
}
