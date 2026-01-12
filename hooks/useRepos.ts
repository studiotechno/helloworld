// React Query hook for fetching user repositories

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useState } from 'react'
import type { GitHubRepo } from '@/lib/github/types'

interface ApiError {
  error: {
    code: string
    message: string
  }
}

async function fetchRepos(forceRefresh = false): Promise<GitHubRepo[]> {
  const url = forceRefresh ? '/api/repos?refresh=true' : '/api/repos'
  const res = await fetch(url)

  if (!res.ok) {
    const errorData: ApiError = await res.json()
    throw new Error(errorData.error?.message || 'Failed to fetch repos')
  }

  return res.json()
}

export function useRepos() {
  const queryClient = useQueryClient()
  const [isRefreshing, setIsRefreshing] = useState(false)

  const query = useQuery({
    queryKey: ['repos'],
    queryFn: () => fetchRepos(false),
    staleTime: 5 * 60 * 1000, // 5 minutes (match server cache TTL)
    retry: (failureCount, error) => {
      // Don't retry on auth errors
      if (error instanceof Error && error.message.includes('authentifie')) {
        return false
      }
      return failureCount < 3
    },
  })

  // Force refresh from GitHub API (bypasses cache)
  const forceRefresh = useCallback(async () => {
    setIsRefreshing(true)
    try {
      const freshRepos = await fetchRepos(true)
      queryClient.setQueryData(['repos'], freshRepos)
    } finally {
      setIsRefreshing(false)
    }
  }, [queryClient])

  return {
    ...query,
    forceRefresh,
    isRefreshing,
  }
}
