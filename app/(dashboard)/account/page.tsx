'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Progress } from '@/components/ui/progress'
import {
  CreditCard,
  FileText,
  Settings2,
  Crown,
  Zap,
  Calendar,
  ArrowUpRight,
  Loader2,
  Database,
} from 'lucide-react'
import { useSubscription } from '@/hooks/useSubscription'
import { cn } from '@/lib/utils'

function formatNumber(num: number): string {
  return num.toLocaleString('fr-FR')
}

function formatDate(dateString: string | null): string {
  if (!dateString) return '-'
  return new Date(dateString).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export default function AccountPage() {
  const router = useRouter()
  const { data: subscription, isLoading, error } = useSubscription()
  const [portalLoading, setPortalLoading] = useState(false)

  const openCustomerPortal = async () => {
    setPortalLoading(true)
    try {
      const response = await fetch('/api/stripe/portal', {
        method: 'POST',
      })
      const data = await response.json()

      if (data.url) {
        window.location.href = data.url
      } else {
        console.error('Portal error:', data.error)
      }
    } catch (error) {
      console.error('Portal error:', error)
    } finally {
      setPortalLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-4xl">
        <Skeleton className="h-10 w-48 mb-8" />
        <div className="space-y-6">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-4xl">
        <h1 className="text-3xl font-bold mb-8">Mon compte</h1>
        <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">
              Impossible de charger les informations du compte.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const plan = subscription?.plan || 'free'
  const planName = subscription?.planName || 'Free'
  const tokensUsed = subscription?.tokensUsed || 0
  const tokenLimit = subscription?.tokenLimit || 40000
  const usagePercent = subscription?.tokenUsagePercent || 0
  const isLimitReached = usagePercent >= 100
  const isNearLimit = usagePercent >= 80
  const isFree = plan === 'free'

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold">Mon compte</h1>
        <div className={cn(
          "flex items-center gap-1 text-sm px-3 py-1.5 rounded-full border",
          plan === 'pro' ? 'bg-primary text-primary-foreground border-primary' :
          plan === 'plus' ? 'bg-secondary text-secondary-foreground border-secondary' :
          'bg-background text-muted-foreground border-border'
        )}>
          <Crown className={cn(
            "size-4",
            plan === 'pro' ? 'text-yellow-500' : plan === 'plus' ? 'text-primary-foreground' : 'text-muted-foreground'
          )} />
          {planName}
        </div>
      </div>

      <div className="space-y-6">
        {/* Subscription Card */}
        <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="size-5 text-primary" />
              Abonnement
            </CardTitle>
            <CardDescription>
              Gerez votre abonnement et vos moyens de paiement
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Plan Info */}
            <div className="flex items-center justify-between p-4 rounded-lg border border-border/50 bg-muted/30">
              <div>
                <p className="text-sm text-muted-foreground">Plan actuel</p>
                <p className="text-xl font-semibold">{planName}</p>
                {!isFree && subscription?.currentPeriodEnd && (
                  <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                    <Calendar className="size-3" />
                    Renouvellement le {formatDate(subscription.currentPeriodEnd)}
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                {isFree ? (
                  <Button onClick={() => router.push('/pricing')}>
                    <Zap className="size-4 mr-2" />
                    Passer a Plus
                  </Button>
                ) : (
                  <>
                    <Button variant="outline" onClick={() => router.push('/pricing')}>
                      Changer de plan
                    </Button>
                    <Button onClick={openCustomerPortal} disabled={portalLoading}>
                      {portalLoading ? (
                        <Loader2 className="size-4 mr-2 animate-spin" />
                      ) : (
                        <Settings2 className="size-4 mr-2" />
                      )}
                      Gerer
                    </Button>
                  </>
                )}
              </div>
            </div>

            {/* Usage Stats */}
            <div className="space-y-4">
              <h3 className="font-medium">Utilisation ce mois-ci</h3>

              {/* Tokens */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Tokens utilises</span>
                  <span className={cn(
                    "font-medium",
                    isLimitReached ? 'text-red-500' : isNearLimit ? 'text-yellow-500' : ''
                  )}>
                    {formatNumber(tokensUsed)} / {formatNumber(tokenLimit)}
                  </span>
                </div>
                <Progress
                  value={Math.min(usagePercent, 100)}
                  className={cn(
                    "h-2",
                    isLimitReached && "[&>div]:bg-red-500",
                    isNearLimit && !isLimitReached && "[&>div]:bg-yellow-500"
                  )}
                />
                {isLimitReached && (
                  <p className="text-sm text-red-500 flex items-center gap-1">
                    <Zap className="size-3" />
                    Limite atteinte - Passez au niveau superieur pour continuer
                  </p>
                )}
              </div>

              {/* Repos */}
              <div className="flex items-center justify-between p-3 rounded-lg border border-border/50">
                <div className="flex items-center gap-2">
                  <Database className="size-4 text-blue-500" />
                  <span className="text-sm">Repositories connectes</span>
                </div>
                <span className="text-sm font-medium">
                  {subscription?.reposConnected || 0} / {subscription?.repoLimit === -1 ? '∞' : subscription?.repoLimit || 1}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Billing Management Card - Only for paid users */}
        {!isFree && (
          <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="size-5 text-orange-500" />
                Facturation
              </CardTitle>
              <CardDescription>
                Consultez vos factures et gerez vos moyens de paiement
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2">
                <button
                  onClick={openCustomerPortal}
                  disabled={portalLoading}
                  className="flex items-center justify-between p-4 rounded-lg border border-border/50 hover:bg-muted/50 transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    <FileText className="size-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">Factures</p>
                      <p className="text-sm text-muted-foreground">
                        Voir l&apos;historique de facturation
                      </p>
                    </div>
                  </div>
                  <ArrowUpRight className="size-4 text-muted-foreground" />
                </button>

                <button
                  onClick={openCustomerPortal}
                  disabled={portalLoading}
                  className="flex items-center justify-between p-4 rounded-lg border border-border/50 hover:bg-muted/50 transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    <CreditCard className="size-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">Moyen de paiement</p>
                      <p className="text-sm text-muted-foreground">
                        Modifier votre carte bancaire
                      </p>
                    </div>
                  </div>
                  <ArrowUpRight className="size-4 text-muted-foreground" />
                </button>
              </div>

              {subscription?.cancelAtPeriodEnd && (
                <div className="mt-4 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                  <p className="text-sm text-yellow-600">
                    Votre abonnement sera annule le {formatDate(subscription.currentPeriodEnd)}.
                    Vous conserverez l&apos;acces jusqu&apos;a cette date.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Upgrade CTA for free users */}
        {isFree && (
          <Card className="border-primary/50 bg-primary/5 backdrop-blur-sm">
            <CardContent className="py-8 text-center">
              <Crown className="mx-auto size-12 text-primary mb-4" />
              <h3 className="text-xl font-semibold mb-2">Passez a Plus</h3>
              <p className="text-muted-foreground mb-4 max-w-md mx-auto">
                Debloquez 1 million de tokens par mois, 5 repositories et un support prioritaire.
              </p>
              <Button size="lg" onClick={() => router.push('/pricing')}>
                Voir les plans
                <ArrowUpRight className="size-4 ml-2" />
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
