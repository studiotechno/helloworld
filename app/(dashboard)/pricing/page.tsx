'use client'

import { useSearchParams } from 'next/navigation'
import { useEffect } from 'react'
import { PricingTable } from '@/components/billing/PricingTable'
import { useSubscription } from '@/hooks/useSubscription'
import { Skeleton } from '@/components/ui/skeleton'
import { CheckCircle2, XCircle } from 'lucide-react'

export default function PricingPage() {
  const searchParams = useSearchParams()
  const checkout = searchParams.get('checkout')
  const { data: subscription, isLoading } = useSubscription()

  // Show toast based on checkout result
  useEffect(() => {
    if (checkout === 'canceled') {
      // Could show a toast here
      console.log('Checkout was canceled')
    }
  }, [checkout])

  return (
    <div className="container mx-auto py-12 px-4">
      <div className="max-w-4xl mx-auto text-center mb-12">
        <h1 className="text-4xl font-bold tracking-tight mb-4">
          Choisissez votre plan
        </h1>
        <p className="text-lg text-muted-foreground">
          Commencez gratuitement, puis passez a un plan superieur selon vos besoins.
        </p>

        {checkout === 'canceled' && (
          <div className="mt-6 inline-flex items-center gap-2 bg-yellow-500/10 text-yellow-600 px-4 py-2 rounded-lg">
            <XCircle className="size-5" />
            <span>Paiement annule. Vous pouvez reessayer quand vous voulez.</span>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="grid gap-6 md:grid-cols-3 max-w-5xl mx-auto">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-[400px] rounded-xl" />
          ))}
        </div>
      ) : (
        <PricingTable
          currentPlan={subscription?.plan}
          isLoading={isLoading}
        />
      )}

      {/* FAQ Section */}
      <div className="max-w-3xl mx-auto mt-20">
        <h2 className="text-2xl font-bold text-center mb-8">
          Questions frequentes
        </h2>

        <div className="space-y-6">
          <div className="border border-border/50 rounded-lg p-6">
            <h3 className="font-semibold mb-2">Puis-je changer de plan a tout moment ?</h3>
            <p className="text-muted-foreground">
              Oui, vous pouvez passer a un plan superieur ou inferieur a tout moment.
              Les changements prennent effet immediatement.
            </p>
          </div>

          <div className="border border-border/50 rounded-lg p-6">
            <h3 className="font-semibold mb-2">Que se passe-t-il si j&apos;atteins ma limite de tokens ?</h3>
            <p className="text-muted-foreground">
              Vous ne pourrez plus utiliser le chat jusqu&apos;a la prochaine periode de facturation,
              ou vous pouvez passer a un plan superieur pour continuer.
            </p>
          </div>

          <div className="border border-border/50 rounded-lg p-6">
            <h3 className="font-semibold mb-2">Puis-je annuler mon abonnement ?</h3>
            <p className="text-muted-foreground">
              Oui, vous pouvez annuler a tout moment depuis vos parametres.
              Vous conserverez l&apos;acces jusqu&apos;a la fin de votre periode de facturation.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
