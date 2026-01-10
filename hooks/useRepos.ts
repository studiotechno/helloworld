// React Query hook for fetching user repositories

import { useQuery } from '@tanstack/react-query'
import type { GitHubRepo } from '@/lib/github/types'

interface ApiError {
  error: {
    code: string
    message: string
  }
}

async function fetchRepos(): Promise<GitHubRepo[]> {
  const res = await fetch('/api/repos')

  if (!res.ok) {
    const errorData: ApiError = await res.json()
    throw new Error(errorData.error?.message || 'Failed to fetch repos')
  }

  return res.json()
}

export function useRepos() {
  return useQuery({
    queryKey: ['repos'],
    queryFn: fetchRepos,
    staleTime: 5 * 60 * 1000, // 5 minutes (match server cache TTL)
    retry: (failureCount, error) => {
      // Don't retry on auth errors
      if (error instanceof Error && error.message.includes('authentifie')) {
        return false
      }
      return failureCount < 3
    },
  })
}
