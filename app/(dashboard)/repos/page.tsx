'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { FolderGit2 } from 'lucide-react'
import { toast } from 'sonner'
import { RepoList, SizeWarningDialog, IndexedReposSection } from '@/components/repos'
import { useConnectRepo } from '@/hooks/useConnectRepo'
import { useRepos } from '@/hooks/useRepos'
import { checkRepoSizeWarning } from '@/lib/github/client'
import type { GitHubRepo } from '@/lib/github/types'

export default function ReposPage() {
  const router = useRouter()
  const { data: repos } = useRepos()
  const connectRepo = useConnectRepo()

  // Size warning dialog state
  const [showSizeWarning, setShowSizeWarning] = useState(false)
  const [pendingRepo, setPendingRepo] = useState<GitHubRepo | null>(null)

  const performConnect = useCallback(
    async (repo: GitHubRepo) => {
      try {
        const result = await connectRepo.mutateAsync({
          repoId: repo.id,
          fullName: repo.full_name,
          defaultBranch: repo.default_branch,
          size: repo.size,
        })

        // Show warning toast if returned from API
        if (result.warning) {
          toast.warning(result.warning.message)
        }

        toast.success('Repository connecte')

        // Navigate to dashboard (chat will be available in Epic 3)
        router.push('/dashboard')
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : 'Impossible de connecter le repository'
        )
      }
    },
    [connectRepo, router]
  )

  const handleSelectRepo = useCallback(
    (repoId: number) => {
      // Find the full repo data
      const repo = repos?.find((r) => r.id === repoId)
      if (!repo) {
        toast.error('Repository introuvable')
        return
      }

      // Check if repo exceeds size limit
      const sizeCheck = checkRepoSizeWarning(repo.size)

      if (sizeCheck.exceedsLimit) {
        // Show warning dialog
        setPendingRepo(repo)
        setShowSizeWarning(true)
      } else {
        // Connect directly
        performConnect(repo)
      }
    },
    [repos, performConnect]
  )

  const handleSizeWarningConfirm = useCallback(() => {
    if (pendingRepo) {
      performConnect(pendingRepo)
      setShowSizeWarning(false)
      setPendingRepo(null)
    }
  }, [pendingRepo, performConnect])

  const handleSizeWarningCancel = useCallback(() => {
    setShowSizeWarning(false)
    setPendingRepo(null)
  }, [])

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="rounded-lg bg-pink-500/10 p-2">
            <FolderGit2 className="h-6 w-6 text-pink-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              Séléctionnez un repository
            </h1>
            <p className="text-sm text-muted-foreground">
              Choisissez le repository GitHub que vous souhaitez analyser
            </p>
          </div>
        </div>

        {/* Indexed repos section */}
        <IndexedReposSection />

        {/* Repo list with search */}
        <RepoList onSelectRepo={handleSelectRepo} />

        {/* Size warning dialog */}
        {pendingRepo && (
          <SizeWarningDialog
            open={showSizeWarning}
            onOpenChange={setShowSizeWarning}
            repoName={pendingRepo.full_name}
            sizeKB={pendingRepo.size}
            onConfirm={handleSizeWarningConfirm}
            onCancel={handleSizeWarningCancel}
            isLoading={connectRepo.isPending}
          />
        )}
      </div>
    </div>
  )
}
