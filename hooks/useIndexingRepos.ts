import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import type { IndexingRepository } from '@/app/api/repos/indexing/route'

async function fetchIndexingRepos(): Promise<IndexingRepository[]> {
  const res = await fetch('/api/repos/indexing')

  if (!res.ok) {
    const errorData = await res.json()
    throw new Error(errorData.error?.message || 'Failed to fetch indexing repos')
  }

  return res.json()
}

export function useIndexingRepos() {
  const queryClient = useQueryClient()
  const previousIdsRef = useRef<Set<string>>(new Set())

  const query = useQuery({
    queryKey: ['indexingRepos'],
    queryFn: fetchIndexingRepos,
    // Poll every 2 seconds to get real-time updates
    refetchInterval: 2000,
    staleTime: 1000,
  })

  // Detect when a repo completes indexation and invalidate indexed repos
  useEffect(() => {
    if (!query.data) return

    const currentIds = new Set(query.data.map((repo) => repo.id))
    const previousIds = previousIdsRef.current

    // Check if any repo was removed from the list (completed indexation)
    const completedIds = [...previousIds].filter((id) => !currentIds.has(id))

    if (completedIds.length > 0) {
      // Invalidate indexed repos to refresh the list
      queryClient.invalidateQueries({ queryKey: ['indexedRepos'] })
    }

    previousIdsRef.current = currentIds
  }, [query.data, queryClient])

  return query
}
