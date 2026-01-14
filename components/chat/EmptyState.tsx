'use client'

import { useRouter } from 'next/navigation'
import { MessageSquare, FolderGit2, Database, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SuggestionChips, Suggestion } from './SuggestionChips'
import { cn } from '@/lib/utils'

type EmptyStateMode = 'no-repo' | 'not-indexed' | 'indexing' | 'ready'

interface EmptyStateProps {
  mode?: EmptyStateMode
  repoName?: string
  onSuggestionClick?: (suggestion: string) => void
  onIndexRepo?: () => void
}

const defaultSuggestions: Suggestion[] = [
  { emoji: '🔧', text: "C'est quoi la stack technique?" },
  { emoji: '🎯', text: 'Quelles sont les features principales?' },
  { emoji: '🗄️', text: 'Montre-moi le schema de la BDD' },
  { emoji: '📁', text: 'Comment est structure le projet?' },
]

export function EmptyState({ mode = 'ready', repoName, onSuggestionClick, onIndexRepo }: EmptyStateProps) {
  const router = useRouter()

  // No repo connected - show connect button
  if (mode === 'no-repo') {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-8 px-4 py-12">
        <div className="relative">
          <div
            className={cn(
              'absolute inset-0 rounded-full blur-2xl',
              'bg-muted/50'
            )}
            style={{ transform: 'scale(1.5)' }}
          />
          <div
            className={cn(
              'relative rounded-2xl p-6',
              'bg-gradient-to-br from-muted/50 to-muted/20',
              'border border-border/50'
            )}
          >
            <FolderGit2 className="size-12 text-muted-foreground" />
          </div>
        </div>

        <div className="space-y-3 text-center">
          <h2 className="text-2xl font-bold md:text-3xl text-foreground">
            Connectez votre repository
          </h2>
          <p className="mx-auto max-w-md text-muted-foreground">
            Pour commencer, sélectionnez un repository GitHub à analyser.
          </p>
        </div>

        <Button
          onClick={() => router.push('/repos')}
          size="lg"
          className="gap-2 rounded-xl bg-primary text-primary-foreground shadow-[var(--glow-pink)] hover:shadow-[0_0_30px_oklch(0.656_0.241_354.308_/_60%)]"
        >
          <FolderGit2 className="size-5" />
          Connecter un repository
        </Button>
      </div>
    )
  }

  // Repo connected but not indexed - show index button
  if (mode === 'not-indexed') {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-8 px-4 py-12">
        <div className="relative">
          <div
            className={cn(
              'absolute inset-0 rounded-full blur-2xl',
              'bg-amber-500/20'
            )}
            style={{ transform: 'scale(1.5)' }}
          />
          <div
            className={cn(
              'relative rounded-2xl p-6',
              'bg-gradient-to-br from-amber-500/20 to-amber-500/5',
              'border border-amber-500/30'
            )}
          >
            <Database className="size-12 text-amber-500" />
          </div>
        </div>

        <div className="space-y-3 text-center">
          <h2 className="text-2xl font-bold md:text-3xl text-foreground">
            Indexez votre repository
          </h2>
          <p className="mx-auto max-w-md text-muted-foreground">
            {repoName ? (
              <>
                <span className="font-medium text-foreground">{repoName}</span> est connecte.
                Lancez l&apos;indexation pour pouvoir poser vos questions.
              </>
            ) : (
              "Lancez l'indexation pour analyser le code et pouvoir poser vos questions."
            )}
          </p>
        </div>

        <Button
          onClick={onIndexRepo}
          size="lg"
          className="gap-2 rounded-xl bg-amber-500 text-white hover:bg-amber-600"
        >
          <Database className="size-5" />
          Indexer le repository
        </Button>
      </div>
    )
  }

  // Indexing in progress
  if (mode === 'indexing') {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-8 px-4 py-12">
        <div className="relative">
          <div
            className={cn(
              'absolute inset-0 rounded-full blur-2xl',
              'bg-pink-500/20 animate-pulse'
            )}
            style={{ transform: 'scale(1.5)' }}
          />
          <div
            className={cn(
              'relative rounded-2xl p-6',
              'bg-gradient-to-br from-pink-500/20 to-pink-500/5',
              'border border-pink-500/30'
            )}
          >
            <Loader2 className="size-12 text-pink-500 animate-spin" />
          </div>
        </div>

        <div className="space-y-3 text-center">
          <h2 className="text-2xl font-bold md:text-3xl text-foreground">
            Indexation en cours
          </h2>
          <p className="mx-auto max-w-md text-muted-foreground">
            Votre repository est en cours d&apos;analyse. Vous pouvez suivre la progression sur la page des repositories.
          </p>
        </div>

        <Button
          onClick={() => router.push('/repos')}
          variant="outline"
          size="lg"
          className="gap-2 rounded-xl"
        >
          Voir la progression
        </Button>
      </div>
    )
  }

  // Ready - show suggestions (default)
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 px-4 py-12">
      {/* Icon with glow effect */}
      <div className="relative">
        {/* Glow background */}
        <div
          className={cn(
            'absolute inset-0 rounded-full blur-2xl',
            'bg-primary/20 animate-pulse'
          )}
          style={{ transform: 'scale(1.5)' }}
        />
        {/* Icon container */}
        <div
          className={cn(
            'relative rounded-2xl p-6',
            'bg-gradient-to-br from-primary/20 to-primary/5',
            'border border-primary/20'
          )}
        >
          <MessageSquare className="size-12 text-primary" />
        </div>
      </div>

      {/* Gradient title and description */}
      <div className="space-y-3 text-center">
        <h2
          className={cn(
            'text-2xl font-bold md:text-3xl',
            'bg-gradient-to-r from-primary via-pink-400 to-primary',
            'bg-clip-text text-transparent',
            'animate-gradient bg-[length:200%_auto]'
          )}
        >
          Posez votre premiere question
        </h2>
        <p className="mx-auto max-w-md text-muted-foreground">
          Interrogez votre codebase en langage naturel. Je suis la pour vous
          aider à comprendre votre code.
        </p>
      </div>

      {/* Suggestion chips */}
      <SuggestionChips
        suggestions={defaultSuggestions}
        onSelect={onSuggestionClick}
        className="max-w-2xl"
      />
    </div>
  )
}
