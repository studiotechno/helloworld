'use client'

import { useQuery } from '@tanstack/react-query'

interface TechnologiesResponse {
  technologies: string[]
}

async function fetchRepoTechnologies(): Promise<string[]> {
  const res = await fetch('/api/repos/technologies')

  if (!res.ok) {
    const error = await res.json()
    throw new Error(error.error?.message || 'Failed to fetch technologies')
  }

  const data: TechnologiesResponse = await res.json()
  return data.technologies
}

export function useRepoTechnologies(enabled: boolean = true) {
  return useQuery({
    queryKey: ['repoTechnologies'],
    queryFn: fetchRepoTechnologies,
    staleTime: 10 * 60 * 1000, // 10 minutes - languages don't change often
    enabled,
    retry: (failureCount, error) => {
      // Don't retry on auth errors
      if (error instanceof Error && error.message.includes('authentifie')) {
        return false
      }
      return failureCount < 2
    },
  })
}
