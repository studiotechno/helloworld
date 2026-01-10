'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'

async function disconnectRepo(): Promise<{ success: boolean; deletedCount: number }> {
  const res = await fetch('/api/repos/disconnect', {
    method: 'POST',
  })

  if (!res.ok) {
    const error = await res.json()
    throw new Error(error.error?.message || 'Failed to disconnect repository')
  }

  return res.json()
}

export function useDisconnectRepo() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: disconnectRepo,
    onSuccess: () => {
      // Invalidate all repo-related queries
      queryClient.invalidateQueries({ queryKey: ['repos'] })
      queryClient.invalidateQueries({ queryKey: ['activeRepo'] })
      queryClient.invalidateQueries({ queryKey: ['repoTechnologies'] })
    },
  })
}
