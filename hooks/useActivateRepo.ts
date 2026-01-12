'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { ConnectedRepository } from './useConnectRepo'

interface ActivateRepoResponse {
  repository: ConnectedRepository
}

async function activateRepo(repoId: string): Promise<ActivateRepoResponse> {
  const res = await fetch(`/api/repos/${repoId}/activate`, {
    method: 'POST',
  })

  const data = await res.json()

  if (!res.ok) {
    throw new Error(data.error?.message || 'Failed to activate repository')
  }

  return data
}

export function useActivateRepo() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: activateRepo,
    onSuccess: () => {
      // Invalidate repos list to reflect new active state
      queryClient.invalidateQueries({ queryKey: ['repos'] })
      // Invalidate active repo query
      queryClient.invalidateQueries({ queryKey: ['activeRepo'] })
      // Invalidate indexed repos
      queryClient.invalidateQueries({ queryKey: ['indexedRepos'] })
    },
  })
}
