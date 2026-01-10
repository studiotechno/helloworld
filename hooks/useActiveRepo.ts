'use client'

import { useQuery } from '@tanstack/react-query'
import type { ConnectedRepository } from './useConnectRepo'

interface ActiveRepoResponse {
  repository: ConnectedRepository | null
}

async function fetchActiveRepo(): Promise<ConnectedRepository | null> {
  const res = await fetch('/api/repos/active')

  if (!res.ok) {
    const error = await res.json()
    throw new Error(error.error?.message || 'Failed to fetch active repository')
  }

  const data: ActiveRepoResponse = await res.json()
  return data.repository
}

export function useActiveRepo() {
  return useQuery({
    queryKey: ['activeRepo'],
    queryFn: fetchActiveRepo,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: (failureCount, error) => {
      // Don't retry on auth errors
      if (error instanceof Error && error.message.includes('authentifie')) {
        return false
      }
      return failureCount < 3
    },
  })
}
