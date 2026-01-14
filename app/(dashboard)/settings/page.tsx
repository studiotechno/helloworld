'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { AlertTriangle, User, Mail, Github, Calendar, FolderGit2, GitBranch, Unplug, Crown } from 'lucide-react'
import { DeleteAccountDialog } from '@/components/settings/DeleteAccountDialog'
import { InstructionsCard } from '@/components/settings/InstructionsCard'
import { UsageCard } from '@/components/settings/UsageCard'
import { DisconnectRepoDialog } from '@/components/repos/DisconnectRepoDialog'
import { TechTags } from '@/components/layout/TechTags'
import { useActiveRepo, useRepoTechnologies, useDisconnectRepo } from '@/hooks'
import { useSubscription } from '@/hooks/useSubscription'
import { cn } from '@/lib/utils'

interface UserProfile {
  name: string
  email: string | null
  avatarUrl: string | null
  githubId: string
  createdAt: Date
}

export default function SettingsPage() {
  const [user, setUser] = useState<UserProfile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [disconnectDialogOpen, setDisconnectDialogOpen] = useState(false)

  // Repository hooks
  const { data: activeRepo, isLoading: repoLoading } = useActiveRepo()
  const { data: technologies } = useRepoTechnologies(!!activeRepo)
  const disconnectMutation = useDisconnectRepo()

  // Subscription hook
  const { data: subscription } = useSubscription()

  useEffect(() => {
    async function loadUser() {
      const supabase = createClient()
      const { data: { user: authUser } } = await supabase.auth.getUser()

      if (authUser) {
        const metadata = authUser.user_metadata as {
          name?: string
          full_name?: string
          user_name?: string
          avatar_url?: string
          provider_id?: string
          sub?: string
        }

        setUser({
          name: metadata.name || metadata.full_name || metadata.user_name || 'Utilisateur',
          email: authUser.email || null,
          avatarUrl: metadata.avatar_url || null,
          githubId: metadata.provider_id || metadata.sub || authUser.id,
          createdAt: new Date(authUser.created_at),
        })
      }
      setIsLoading(false)
    }

    loadUser()
  }, [])

  const initials = user?.name
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'U'

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="mx-auto max-w-6xl space-y-8">
          <Skeleton className="h-8 w-48" />
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-4 w-48" />
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center gap-4">
                <Skeleton className="size-16 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-4 w-48" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="mx-auto max-w-6xl space-y-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Paramètres</h1>
          <p className="text-muted-foreground">Gérez votre compte et vos préférences</p>
        </div>

        {/* Profile Card */}
        <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle>Profil</CardTitle>
            <CardDescription>Informations de votre compte</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Avatar and Name */}
            <div className="flex items-center gap-4">
              <Avatar className="size-16 ring-2 ring-primary/20">
                <AvatarImage src={user?.avatarUrl || undefined} alt={user?.name || ''} />
                <AvatarFallback className="bg-primary/10 text-lg text-primary">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div>
                <h3 className="text-lg font-semibold">{user?.name}</h3>
                <p className="text-sm text-muted-foreground">Compte GitHub connecté</p>
              </div>
            </div>

            <Separator />

            {/* Profile Details */}
            <div className="grid gap-4">
              <div className="flex items-center gap-3">
                <User className="size-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Nom</p>
                  <p className="text-foreground">{user?.name}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Mail className="size-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Email</p>
                  <p className="text-foreground">{user?.email || 'Non renseigné'}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Github className="size-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">GitHub ID</p>
                  <p className="font-mono text-sm text-foreground">{user?.githubId}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Calendar className="size-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Membre depuis</p>
                  <p className="text-foreground">
                    {user?.createdAt.toLocaleDateString('fr-FR', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Crown className={cn(
                  "size-4",
                  subscription?.plan === 'pro' ? 'text-yellow-500' :
                  subscription?.plan === 'plus' ? 'text-primary' :
                  'text-muted-foreground'
                )} />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Abonnement</p>
                  <p className="text-foreground">{subscription?.planName || 'Free'}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Usage Card */}
        <UsageCard />

        {/* Instructions Card */}
        <InstructionsCard />

        {/* Repository Card */}
        <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FolderGit2 className="size-5 text-pink-500" />
              Repository connecte
            </CardTitle>
            <CardDescription>
              Gerez votre repository GitHub connecte
            </CardDescription>
          </CardHeader>
          <CardContent>
            {repoLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-4 w-32" />
              </div>
            ) : activeRepo ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="font-medium text-foreground">{activeRepo.full_name}</p>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <GitBranch className="size-4" />
                      <span>{activeRepo.default_branch}</span>
                    </div>
                  </div>
                  {technologies && technologies.length > 0 && (
                    <TechTags technologies={technologies} maxVisible={4} />
                  )}
                </div>

                <Separator />

                <div className="flex items-center justify-between rounded-lg border border-border/50 bg-muted/30 p-4">
                  <div>
                    <p className="font-medium">Déconnecter ce repository</p>
                    <p className="text-sm text-muted-foreground">
                      Vos conversations resteront accessibles
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    className="gap-2"
                    onClick={() => setDisconnectDialogOpen(true)}
                  >
                    <Unplug className="size-4" />
                    Déconnecter
                  </Button>
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-border/50 p-6 text-center">
                <FolderGit2 className="mx-auto size-8 text-muted-foreground/50" />
                <p className="mt-2 text-sm text-muted-foreground">
                  Aucun repository connecte
                </p>
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => window.location.href = '/repos'}
                >
                  Connecter un repository
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Danger Zone */}
        <Card className="border-destructive/50 bg-destructive/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="size-5" />
              Zone de danger
            </CardTitle>
            <CardDescription>
              Actions irréversibles sur votre compte
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between rounded-lg border border-destructive/30 bg-destructive/10 p-4">
              <div>
                <p className="font-medium text-destructive">Supprimer mon compte</p>
                <p className="text-sm text-muted-foreground">
                  Supprime définitivement votre compte et toutes vos données
                </p>
              </div>
              <Button
                variant="destructive"
                onClick={() => setDeleteDialogOpen(true)}
              >
                Supprimer
              </Button>
            </div>
          </CardContent>
        </Card>

        <DeleteAccountDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
        />

        {activeRepo && (
          <DisconnectRepoDialog
            open={disconnectDialogOpen}
            onOpenChange={setDisconnectDialogOpen}
            repoName={activeRepo.full_name}
            onDisconnect={() => disconnectMutation.mutateAsync()}
          />
        )}
      </div>
    </div>
  )
}
