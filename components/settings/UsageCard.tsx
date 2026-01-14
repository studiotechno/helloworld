'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { BarChart3, MessageSquare, Database, Cpu } from 'lucide-react'
import { useTokenUsage } from '@/hooks/useTokenUsage'

/**
 * Format a number with thousands separators
 */
function formatNumber(num: number): string {
  return num.toLocaleString('fr-FR')
}

export function UsageCard() {
  const { data: usage, isLoading, error } = useTokenUsage()

  if (isLoading) {
    return (
      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent className="space-y-6">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="size-5 text-orange-500" />
            Consommation de tokens
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Impossible de charger les statistiques d&apos;usage.
          </p>
        </CardContent>
      </Card>
    )
  }

  const totalTokens = (usage?.total.input_tokens || 0) + (usage?.total.output_tokens || 0)
  const chatTokens = (usage?.chat.input_tokens || 0) + (usage?.chat.output_tokens || 0)
  const indexingTokens = (usage?.indexing.input_tokens || 0) + (usage?.indexing.output_tokens || 0)

  return (
    <Card id="usage" className="border-border/50 bg-card/50 backdrop-blur-sm scroll-mt-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="size-5 text-orange-500" />
          Consommation de tokens
        </CardTitle>
        <CardDescription>
          Suivi de votre utilisation
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Total Summary */}
        <div className="rounded-lg border border-border/50 bg-muted/30 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total consommé</p>
              <p className="text-3xl font-bold text-foreground">
                {formatNumber(totalTokens)}
              </p>
              <p className="text-xs text-muted-foreground">tokens</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{formatNumber(usage?.total.input_tokens || 0)}</span> input
              </p>
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{formatNumber(usage?.total.output_tokens || 0)}</span> output
              </p>
            </div>
          </div>
        </div>

        <Separator />

        {/* By Type */}
        <div className="grid gap-4 sm:grid-cols-2">
          {/* Chat */}
          <div className="rounded-lg border border-border/50 p-4">
            <div className="flex items-center gap-2 mb-3">
              <MessageSquare className="size-4 text-pink-500" />
              <p className="font-medium">Chat</p>
            </div>
            <p className="text-2xl font-bold">{formatNumber(chatTokens)}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {formatNumber(usage?.chat.input_tokens || 0)} in / {formatNumber(usage?.chat.output_tokens || 0)} out
            </p>
          </div>

          {/* Indexation */}
          <div className="rounded-lg border border-border/50 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Database className="size-4 text-blue-500" />
              <p className="font-medium">Indéxation</p>
            </div>
            <p className="text-2xl font-bold">{formatNumber(indexingTokens)}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {formatNumber(usage?.indexing.input_tokens || 0)} in / {formatNumber(usage?.indexing.output_tokens || 0)} out
            </p>
          </div>
        </div>

        {/* By Model */}
        {usage?.by_model && Object.keys(usage.by_model).length > 0 && (
          <>
            <Separator />
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Cpu className="size-4 text-muted-foreground" />
                <p className="text-sm font-medium text-muted-foreground">Par modèle</p>
              </div>
              <div className="space-y-2">
                {Object.entries(usage.by_model).map(([model, stats]) => (
                  <div
                    key={model}
                    className="flex items-center justify-between rounded-md border border-border/30 px-3 py-2"
                  >
                    <span className="font-mono text-sm">{model}</span>
                    <div className="text-right">
                      <span className="text-sm font-medium">
                        {formatNumber(stats.input + stats.output)}
                      </span>
                      <span className="ml-2 text-xs text-muted-foreground">
                        ({formatNumber(stats.input)} in / {formatNumber(stats.output)} out)
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Empty State */}
        {totalTokens === 0 && (
          <div className="rounded-lg border border-dashed border-border/50 p-6 text-center">
            <BarChart3 className="mx-auto size-8 text-muted-foreground/50" />
            <p className="mt-2 text-sm text-muted-foreground">
              Aucune consommation enregistree
            </p>
            <p className="text-xs text-muted-foreground/70">
              Vos statistiques apparaitront ici apres utilisation du chat ou de l&apos;indexation
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
