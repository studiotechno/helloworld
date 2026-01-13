'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { IndexingStatusData, IndexingStatus } from '@/components/repos/IndexingProgress'

interface UseIndexingStatusOptions {
  /** Enable polling when indexation is in progress (default: true) */
  enablePolling?: boolean
  /** Polling interval in ms (default: 2000) */
  pollingInterval?: number
  /** Callback when status changes */
  onStatusChange?: (status: IndexingStatusData) => void
}

async function fetchIndexingStatus(repositoryId: string): Promise<IndexingStatusData> {
  const response = await fetch(`/api/repos/${repositoryId}/index/status`)

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: { message: 'Erreur inconnue' } }))
    throw new Error(error.error?.message || 'Erreur lors de la recuperation du statut')
  }

  return response.json()
}

async function startIndexing(repositoryId: string): Promise<{ jobId: string; status: string }> {
  const response = await fetch(`/api/repos/${repositoryId}/index`, {
    method: 'POST',
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: { message: 'Erreur inconnue' } }))
    throw new Error(error.error?.message || 'Erreur lors du demarrage de l\'indexation')
  }

  return response.json()
}

async function cancelIndexing(repositoryId: string): Promise<void> {
  const response = await fetch(`/api/repos/${repositoryId}/index`, {
    method: 'DELETE',
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: { message: 'Erreur inconnue' } }))
    throw new Error(error.error?.message || 'Erreur lors de l\'annulation')
  }
}

/**
 * Hook for managing repository indexing status
 *
 * @param repositoryId - The repository ID to track
 * @param options - Configuration options
 * @returns Indexing status data and control functions
 */
export function useIndexingStatus(
  repositoryId: string | null | undefined,
  options: UseIndexingStatusOptions = {}
) {
  const {
    enablePolling = true,
    pollingInterval = 2000,
    onStatusChange,
  } = options

  const queryClient = useQueryClient()

  // Query for fetching status
  const statusQuery = useQuery({
    queryKey: ['indexingStatus', repositoryId],
    queryFn: () => fetchIndexingStatus(repositoryId!),
    enabled: !!repositoryId,
    staleTime: 1000, // Consider stale after 1 second
    refetchInterval: (query) => {
      if (!enablePolling) return false

      const data = query.state.data
      if (!data) return false

      // Poll only when indexation is in progress
      const inProgressStatuses: IndexingStatus[] = ['pending', 'fetching', 'parsing', 'embedding']
      if (inProgressStatuses.includes(data.status)) {
        return pollingInterval
      }

      return false
    },
    // Notify on status change
    select: (data) => {
      onStatusChange?.(data)
      return data
    },
  })

  // Mutation for starting indexation
  const startMutation = useMutation({
    mutationFn: () => startIndexing(repositoryId!),
    onSuccess: () => {
      // Invalidate status to trigger refetch
      queryClient.invalidateQueries({ queryKey: ['indexingStatus', repositoryId] })
    },
  })

  // Mutation for cancelling indexation
  const cancelMutation = useMutation({
    mutationFn: () => cancelIndexing(repositoryId!),
    onSuccess: () => {
      // Invalidate status to trigger refetch
      queryClient.invalidateQueries({ queryKey: ['indexingStatus', repositoryId] })
    },
  })

  // Derived state
  const status = statusQuery.data?.status ?? 'not_started'
  const isIndexed = statusQuery.data?.isIndexed ?? false
  const isInProgress = ['pending', 'fetching', 'parsing', 'embedding'].includes(status)
  const isFailed = status === 'failed'
  const isCompleted = status === 'completed' || status === 'indexed' || isIndexed

  return {
    // Status data
    status,
    statusData: statusQuery.data ?? null,
    isIndexed,
    isInProgress,
    isFailed,
    isCompleted,
    progress: statusQuery.data?.progress ?? 0,
    error: statusQuery.data?.error ?? null,

    // Query state
    isLoading: statusQuery.isLoading,
    isFetching: statusQuery.isFetching,
    queryError: statusQuery.error,

    // Actions
    startIndexing: () => startMutation.mutate(),
    cancelIndexing: () => cancelMutation.mutate(),
    refetch: () => statusQuery.refetch(),

    // Mutation state
    isStarting: startMutation.isPending,
    isCancelling: cancelMutation.isPending,
    startError: startMutation.error,
    cancelError: cancelMutation.error,
  }
}

/**
 * Helper to get a human-readable status label
 */
export function getStatusLabel(status: IndexingStatus): string {
  const labels: Record<IndexingStatus, string> = {
    not_started: 'Non indexe',
    pending: 'En attente',
    fetching: 'Telechargement',
    parsing: 'Analyse',
    embedding: 'Embeddings',
    completed: 'Indexe',
    indexed: 'Indexe',
    failed: 'Echec',
    cancelled: 'Annule',
  }
  return labels[status] || status
}

/**
 * Helper to get status color class
 */
export function getStatusColor(status: IndexingStatus): string {
  const colors: Record<IndexingStatus, string> = {
    not_started: 'text-muted-foreground',
    pending: 'text-yellow-500',
    fetching: 'text-blue-500',
    parsing: 'text-cyan-500',
    embedding: 'text-purple-500',
    completed: 'text-green-500',
    indexed: 'text-green-500',
    failed: 'text-destructive',
    cancelled: 'text-yellow-500',
  }
  return colors[status] || 'text-muted-foreground'
}

/**
 * Phase color configuration for progress bars
 */
export const phaseColors: Record<string, { text: string; bg: string; border: string; glow: string }> = {
  'Fetching files': {
    text: 'text-blue-500',
    bg: 'bg-blue-500',
    border: 'border-blue-500/30',
    glow: 'shadow-[0_0_15px_-5px_rgba(59,130,246,0.5)]',
  },
  'Parsing code': {
    text: 'text-cyan-500',
    bg: 'bg-cyan-500',
    border: 'border-cyan-500/30',
    glow: 'shadow-[0_0_15px_-5px_rgba(6,182,212,0.5)]',
  },
  'Generating context': {
    text: 'text-amber-500',
    bg: 'bg-amber-500',
    border: 'border-amber-500/30',
    glow: 'shadow-[0_0_15px_-5px_rgba(245,158,11,0.5)]',
  },
  'Generating embeddings': {
    text: 'text-purple-500',
    bg: 'bg-purple-500',
    border: 'border-purple-500/30',
    glow: 'shadow-[0_0_15px_-5px_rgba(168,85,247,0.5)]',
  },
  'Finalizing': {
    text: 'text-green-500',
    bg: 'bg-green-500',
    border: 'border-green-500/30',
    glow: 'shadow-[0_0_15px_-5px_rgba(34,197,94,0.5)]',
  },
  'Initializing': {
    text: 'text-yellow-500',
    bg: 'bg-yellow-500',
    border: 'border-yellow-500/30',
    glow: 'shadow-[0_0_15px_-5px_rgba(234,179,8,0.5)]',
  },
}

export function getPhaseColor(phase: string | null | undefined) {
  return phaseColors[phase || 'Initializing'] || phaseColors['Initializing']
}
