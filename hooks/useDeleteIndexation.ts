'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'

interface DeleteIndexationResponse {
  message: string
  chunksDeleted?: number
}

async function deleteIndexation(repoId: string): Promise<DeleteIndexationResponse> {
  const res = await fetch(`/api/repos/${repoId}/index?force=true`, {
    method: 'DELETE',
  })

  const data = await res.json()

  if (!res.ok) {
    throw new Error(data.error?.message || 'Failed to delete indexation')
  }

  return data
}

export function useDeleteIndexation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: deleteIndexation,
    onSuccess: () => {
      // Invalidate indexed repos list
      queryClient.invalidateQueries({ queryKey: ['indexedRepos'] })
      // Invalidate active repo
      queryClient.invalidateQueries({ queryKey: ['activeRepo'] })
    },
  })
}
