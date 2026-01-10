'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'

export interface ConnectRepoParams {
  repoId: number
  fullName: string
  defaultBranch: string
  size?: number
}

export interface ConnectedRepository {
  id: string
  user_id: string
  github_repo_id: string
  full_name: string
  default_branch: string
  is_active: boolean
  last_synced_at: string | null
  created_at: string
}

export interface ConnectRepoResponse {
  repository: ConnectedRepository
  warning: {
    code: string
    message: string
  } | null
}

export interface ConnectRepoError {
  error: {
    code: string
    message: string
    details?: unknown
  }
}

async function connectRepo(params: ConnectRepoParams): Promise<ConnectRepoResponse> {
  const res = await fetch('/api/repos/connect', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })

  const data = await res.json()

  if (!res.ok) {
    throw new Error(data.error?.message || 'Failed to connect repository')
  }

  return data
}

export function useConnectRepo() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: connectRepo,
    onSuccess: () => {
      // Invalidate repos list to reflect new active state
      queryClient.invalidateQueries({ queryKey: ['repos'] })
      // Invalidate active repo query
      queryClient.invalidateQueries({ queryKey: ['activeRepo'] })
    },
  })
}
