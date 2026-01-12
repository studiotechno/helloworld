'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { UserCog, Users, Check, Loader2 } from 'lucide-react'
import { useUserInstructions, useUpdateUserInstructions } from '@/hooks/useUserInstructions'
import { useDebouncedCallback } from 'use-debounce'

const PROFILE_PLACEHOLDER = `Ex: Je suis PM senior avec 5 ans d'experience. Je suis a l'aise avec GitHub et les concepts techniques. Je prefere des explications detaillees et techniques plutot que vulgarisees. Je connais bien l'architecture logicielle et les methodologies agile.`

const TEAM_PLACEHOLDER = `Ex: Mon equipe compte 6 personnes : 2 devs backend (Node.js/Python), 2 devs frontend (React/TypeScript), 1 fullstack et 1 designer UI/UX. On travaille en sprints de 2 semaines avec des estimations en story points. On fait des daily standups et des retros. Pas de freelances actuellement.`

export function InstructionsCard() {
  const { data: instructions, isLoading } = useUserInstructions()
  const updateMutation = useUpdateUserInstructions()

  const [profileValue, setProfileValue] = useState('')
  const [teamValue, setTeamValue] = useState('')
  const [savingField, setSavingField] = useState<'profile' | 'team' | null>(null)
  const [savedField, setSavedField] = useState<'profile' | 'team' | null>(null)

  // Sync local state when data loads
  useEffect(() => {
    if (instructions) {
      setProfileValue(instructions.profile_instructions || '')
      setTeamValue(instructions.team_instructions || '')
    }
  }, [instructions])

  // Debounced save for profile
  const debouncedSaveProfile = useDebouncedCallback(
    async (value: string) => {
      setSavingField('profile')
      try {
        await updateMutation.mutateAsync({ profile_instructions: value || null })
        setSavedField('profile')
        setTimeout(() => setSavedField(null), 2000)
      } finally {
        setSavingField(null)
      }
    },
    1000
  )

  // Debounced save for team
  const debouncedSaveTeam = useDebouncedCallback(
    async (value: string) => {
      setSavingField('team')
      try {
        await updateMutation.mutateAsync({ team_instructions: value || null })
        setSavedField('team')
        setTimeout(() => setSavedField(null), 2000)
      } finally {
        setSavingField(null)
      }
    },
    1000
  )

  const handleProfileChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const value = e.target.value
      setProfileValue(value)
      debouncedSaveProfile(value)
    },
    [debouncedSaveProfile]
  )

  const handleTeamChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const value = e.target.value
      setTeamValue(value)
      debouncedSaveTeam(value)
    },
    [debouncedSaveTeam]
  )

  const renderSaveIndicator = (field: 'profile' | 'team') => {
    if (savingField === field) {
      return (
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <Loader2 className="size-3 animate-spin" />
          Sauvegarde...
        </span>
      )
    }
    if (savedField === field) {
      return (
        <span className="flex items-center gap-1 text-xs text-green-600">
          <Check className="size-3" />
          Sauvegarde
        </span>
      )
    }
    return null
  }

  if (isLoading) {
    return (
      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent className="space-y-6">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserCog className="size-5 text-blue-500" />
          Instructions personnalisées
        </CardTitle>
        <CardDescription>
          Ces informations sont utilisées pour adapter les réponses à votre contexte
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Profile Instructions */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="profile-instructions" className="flex items-center gap-2">
              <UserCog className="size-4 text-muted-foreground" />
              Votre profil
            </Label>
            {renderSaveIndicator('profile')}
          </div>
          <Textarea
            id="profile-instructions"
            value={profileValue}
            onChange={handleProfileChange}
            placeholder={PROFILE_PLACEHOLDER}
            className="min-h-[120px] resize-y bg-background/50"
            maxLength={2000}
          />
          <p className="text-xs text-muted-foreground">
            Décrivez votre rôle, niveau technique, et vos préférences de communication.
            <span className="ml-2 text-muted-foreground/70">
              {profileValue.length}/2000
            </span>
          </p>
        </div>

        {/* Team Instructions */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="team-instructions" className="flex items-center gap-2">
              <Users className="size-4 text-muted-foreground" />
              Votre equipe
            </Label>
            {renderSaveIndicator('team')}
          </div>
          <Textarea
            id="team-instructions"
            value={teamValue}
            onChange={handleTeamChange}
            placeholder={TEAM_PLACEHOLDER}
            className="min-h-[120px] resize-y bg-background/50"
            maxLength={2000}
          />
          <p className="text-xs text-muted-foreground">
            Décrivez la structure de votre équipe, les technologies utilisées, et votre méthodologie.
            <span className="ml-2 text-muted-foreground/70">
              {teamValue.length}/2000
            </span>
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
