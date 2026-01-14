'use client'

import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { Progress } from '@/components/ui/progress'
import { BarChart3, MessageSquare, Database, Cpu, Zap, Crown } from 'lucide-react'
import { useSubscription } from '@/hooks/useSubscription'
import { cn } from '@/lib/utils'

/**
 * Format a number with thousands separators
 */
function formatNumber(num: number): string {
  return num.toLocaleString('fr-FR')
}

export function UsageCard() {
  const router = useRouter()
  const { data: subscription, isLoading, error } = useSubscription()

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

  const tokensUsed = subscription?.tokensUsed || 0
  const tokenLimit = subscription?.tokenLimit || 40000
  const usagePercent = subscription?.tokenUsagePercent || 0
  const plan = subscription?.plan || 'free'
  const planName = subscription?.planName || 'Free'
  const isLimitReached = usagePercent >= 100
  const isNearLimit = usagePercent >= 80

  return (
    <Card id="usage" className="border-border/50 bg-card/50 backdrop-blur-sm scroll-mt-6">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="size-5 text-orange-500" />
              Consommation de tokens
            </CardTitle>
            <CardDescription>
              Suivi de votre utilisation ce mois-ci
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Crown className={cn(
              "size-4",
              plan === 'business' ? 'text-yellow-500' : plan === 'pro' ? 'text-primary' : 'text-muted-foreground'
            )} />
            <span className="text-sm font-medium">{planName}</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Usage Progress */}
        <div className="space-y-3">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-3xl font-bold text-foreground">
                {formatNumber(tokensUsed)}
              </p>
              <p className="text-sm text-muted-foreground">
                sur {formatNumber(tokenLimit)} tokens
              </p>
            </div>
            <div className="text-right">
              <p className={cn(
                "text-2xl font-bold",
                isLimitReached ? 'text-red-500' : isNearLimit ? 'text-yellow-500' : 'text-foreground'
              )}>
                {usagePercent}%
              </p>
              <p className="text-xs text-muted-foreground">utilisé</p>
            </div>
          </div>

          <Progress
            value={Math.min(usagePercent, 100)}
            className={cn(
              "h-3",
              isLimitReached && "[&>div]:bg-red-500",
              isNearLimit && !isLimitReached && "[&>div]:bg-yellow-500"
            )}
          />

          {isLimitReached && (
            <div className="flex items-center justify-between rounded-lg bg-red-500/10 border border-red-500/20 p-3">
              <div className="flex items-center gap-2 text-red-500">
                <Zap className="size-4" />
                <span className="text-sm font-medium">Limite atteinte</span>
              </div>
              <Button
                size="sm"
                onClick={() => router.push('/pricing')}
              >
                Passer au niveau supérieur
              </Button>
            </div>
          )}

          {isNearLimit && !isLimitReached && (
            <div className="flex items-center justify-between rounded-lg bg-yellow-500/10 border border-yellow-500/20 p-3">
              <div className="flex items-center gap-2 text-yellow-600">
                <Zap className="size-4" />
                <span className="text-sm font-medium">Limite bientôt atteinte</span>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => router.push('/pricing')}
              >
                Voir les plans
              </Button>
            </div>
          )}
        </div>

        <Separator />

        {/* Repos Usage */}
        <div className="flex items-center justify-between rounded-lg border border-border/50 p-4">
          <div className="flex items-center gap-3">
            <Database className="size-5 text-blue-500" />
            <div>
              <p className="font-medium">Repositories</p>
              <p className="text-sm text-muted-foreground">
                {subscription?.reposConnected || 0} / {subscription?.repoLimit === -1 ? '∞' : subscription?.repoLimit || 1}
              </p>
            </div>
          </div>
          {!subscription?.canConnectMoreRepos && subscription?.repoLimit !== -1 && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => router.push('/pricing')}
            >
              Ajouter des repos
            </Button>
          )}
        </div>

        {/* Upgrade CTA for free users */}
        {plan === 'free' && !isLimitReached && (
          <div className="rounded-lg border border-dashed border-primary/50 bg-primary/5 p-4 text-center">
            <Crown className="mx-auto size-8 text-primary mb-2" />
            <p className="font-medium">Passez à Pro</p>
            <p className="text-sm text-muted-foreground mb-3">
              1M tokens/mois et 5 repositories pour 19EUR/mois
            </p>
            <Button onClick={() => router.push('/pricing')}>
              Voir les plans
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
