import { syncUser } from '@/lib/auth/sync-user'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertCircle } from 'lucide-react'

interface GitHubUserMetadata {
  user_name?: string
  name?: string
  full_name?: string
  avatar_url?: string
  email?: string
  provider_id?: string
  sub?: string
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()

  // Try to sync user with Prisma (may fail if DB not configured)
  const prismaUser = await syncUser()

  // Use Prisma user if available, otherwise use Supabase auth data
  const metadata = (authUser?.user_metadata || {}) as GitHubUserMetadata
  const displayName = prismaUser?.name || metadata.name || metadata.full_name || metadata.user_name || 'Utilisateur'
  const email = prismaUser?.email || authUser?.email
  const githubId = prismaUser?.github_id || metadata.provider_id || metadata.sub || authUser?.id
  const createdAt = prismaUser?.created_at || new Date()

  return (
    <div className="p-6">
      <div className="mx-auto max-w-4xl space-y-8">
        {/* Database Warning */}
        {!prismaUser && (
          <div className="rounded-2xl border border-yellow-500/30 bg-yellow-500/10 p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 size-5 shrink-0 text-yellow-500" />
              <div>
                <p className="font-medium text-yellow-500">Base de données non configurée</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Décommentez DATABASE_URL et DIRECT_URL dans .env.local pour activer la persistance des données.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Welcome Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Bienvenue, <span className="text-primary">{displayName}</span>
          </h1>
          <p className="mt-1 text-muted-foreground">
            Votre espace de travail techno
          </p>
        </div>

        {/* User Info Card */}
        <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle>Profil GitHub</CardTitle>
            <CardDescription>Informations de votre compte connecté</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Nom</p>
                <p className="text-foreground">{displayName}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Email</p>
                <p className="text-foreground">{email || 'Non renseigné'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">GitHub ID</p>
                <p className="font-mono text-sm text-foreground">{githubId}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Membre depuis</p>
                <p className="text-foreground">
                  {new Date(createdAt).toLocaleDateString('fr-FR', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Placeholder for next stories */}
        <Card className="border-dashed border-border/50 bg-transparent">
          <CardHeader>
            <CardTitle className="text-muted-foreground">Prochaines étapes</CardTitle>
            <CardDescription>
              Fonctionnalités à venir dans les prochaines stories
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="list-inside list-disc space-y-2 text-sm text-muted-foreground">
              <li>Epic 2: Connexion d&apos;un repository GitHub</li>
              <li>Epic 3: Interface conversationnelle avec votre code</li>
              <li>Epic 4: Analyse de votre codebase</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
