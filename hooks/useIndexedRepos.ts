import { useQuery } from '@tanstack/react-query'
import type { IndexedRepository } from '@/app/api/repos/indexed/route'

async function fetchIndexedRepos(): Promise<IndexedRepository[]> {
  const res = await fetch('/api/repos/indexed')

  if (!res.ok) {
    const errorData = await res.json()
    throw new Error(errorData.error?.message || 'Failed to fetch indexed repos')
  }

  return res.json()
}

export function useIndexedRepos() {
  return useQuery({
    queryKey: ['indexedRepos'],
    queryFn: fetchIndexedRepos,
    staleTime: 30 * 1000, // 30 seconds
  })
}
