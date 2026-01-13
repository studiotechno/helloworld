'use client'

import { useEffect, useState, useCallback } from 'react'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import {
  Loader2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
  FileCode,
  Cpu,
  Database,
  Download,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

export type IndexingStatus =
  | 'not_started'
  | 'pending'
  | 'fetching'
  | 'parsing'
  | 'embedding'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'indexed'

export interface IndexingStatusData {
  status: IndexingStatus
  jobId?: string
  progress?: number
  filesTotal?: number
  filesProcessed?: number
  chunksCreated?: number
  currentPhase?: string
  error?: string
  isIndexed?: boolean
  startedAt?: string
  completedAt?: string
  // Commit tracking
  lastIndexedCommitSha?: string
  lastIndexedCommitShort?: string
  latestCommitSha?: string
  latestCommitShort?: string
  hasNewerCommit?: boolean
  stats?: {
    totalChunks: number
    totalFiles: number
    languages: Record<string, number>
    chunkTypes: Record<string, number>
  }
}

interface IndexingProgressProps {
  repositoryId: string
  onStatusChange?: (status: IndexingStatusData) => void
  onStartIndexing?: () => void
  className?: string
  compact?: boolean
}

const POLL_INTERVAL = 2000 // 2 seconds

// Phase icons and labels
const phaseConfig: Record<string, { icon: typeof Loader2; label: string }> = {
  'Fetching files': { icon: Download, label: 'Recuperation des fichiers' },
  'Parsing code': { icon: FileCode, label: 'Analyse du code' },
  'Generating embeddings': { icon: Cpu, label: 'Generation des embeddings' },
  'Finalizing': { icon: Database, label: 'Finalisation' },
  'Initializing': { icon: Loader2, label: 'Initialisation' },
}

export function IndexingProgress({
  repositoryId,
  onStatusChange,
  onStartIndexing,
  className,
  compact = false,
}: IndexingProgressProps) {
  const [status, setStatus] = useState<IndexingStatusData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchStatus = useCallback(async () => {
    try {
      const response = await fetch(`/api/repos/${repositoryId}/index/status`)

      if (!response.ok) {
        throw new Error('Erreur lors de la recuperation du statut')
      }

      const data: IndexingStatusData = await response.json()
      setStatus(data)
      setError(null)
      onStatusChange?.(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
    } finally {
      setIsLoading(false)
    }
  }, [repositoryId, onStatusChange])

  // Initial fetch
  useEffect(() => {
    fetchStatus()
  }, [fetchStatus])

  // Polling for in-progress statuses
  useEffect(() => {
    if (!status) return

    const isInProgress = ['pending', 'fetching', 'parsing', 'embedding'].includes(status.status)

    if (!isInProgress) return

    const interval = setInterval(fetchStatus, POLL_INTERVAL)
    return () => clearInterval(interval)
  }, [status, fetchStatus])

  const handleStartIndexing = async () => {
    try {
      setIsLoading(true)
      const response = await fetch(`/api/repos/${repositoryId}/index`, {
        method: 'POST',
      })

      if (!response.ok) {
        throw new Error('Erreur lors du demarrage de l\'indexation')
      }

      onStartIndexing?.()
      fetchStatus()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
      setIsLoading(false)
    }
  }

  const handleRetry = () => {
    handleStartIndexing()
  }

  // Loading state
  if (isLoading && !status) {
    return (
      <div className={cn('flex items-center gap-2 text-muted-foreground', className)}>
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm">Chargement...</span>
      </div>
    )
  }

  // Error state
  if (error && !status) {
    return (
      <div className={cn('flex items-center gap-2 text-destructive', className)}>
        <AlertCircle className="h-4 w-4" />
        <span className="text-sm">{error}</span>
      </div>
    )
  }

  if (!status) return null

  // Not started state
  if (status.status === 'not_started') {
    if (compact) {
      return (
        <Button
          variant="outline"
          size="sm"
          onClick={handleStartIndexing}
          className={className}
        >
          <Database className="h-4 w-4 mr-2" />
          Indexer
        </Button>
      )
    }

    return (
      <div className={cn('space-y-3', className)}>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Database className="h-4 w-4" />
          <span className="text-sm">Repository non indexe</span>
        </div>
        <Button onClick={handleStartIndexing} size="sm">
          <Database className="h-4 w-4 mr-2" />
          Demarrer l&apos;indexation
        </Button>
      </div>
    )
  }

  // Completed/Indexed state
  if (status.status === 'completed' || status.status === 'indexed' || status.isIndexed) {
    if (compact) {
      return (
        <div className={cn('flex items-center gap-1.5', className)}>
          <CheckCircle2 className="h-4 w-4 text-green-500" />
          <span className="text-xs font-medium text-green-500">Indexe</span>
        </div>
      )
    }

    return (
      <div className={cn('space-y-2', className)}>
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-green-500" />
          <span className="font-medium text-green-500">Indexation terminee</span>
        </div>
        {status.stats && (
          <div className="text-sm text-muted-foreground space-y-1">
            <p>{status.stats.totalFiles} fichiers • {status.stats.totalChunks} sections</p>
            {Object.keys(status.stats.languages).length > 0 && (
              <p className="text-xs">
                Langages: {Object.keys(status.stats.languages).join(', ')}
              </p>
            )}
          </div>
        )}
        <Button variant="outline" size="sm" onClick={handleRetry}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Re-indexer
        </Button>
      </div>
    )
  }

  // Failed state
  if (status.status === 'failed') {
    if (compact) {
      return (
        <div className={cn('flex items-center gap-1.5', className)}>
          <XCircle className="h-4 w-4 text-destructive" />
          <span className="text-xs font-medium text-destructive">Echec</span>
        </div>
      )
    }

    return (
      <div className={cn('space-y-3', className)}>
        <div className="flex items-center gap-2 text-destructive">
          <XCircle className="h-5 w-5" />
          <span className="font-medium">Indexation echouee</span>
        </div>
        {status.error && (
          <p className="text-sm text-muted-foreground">{status.error}</p>
        )}
        <Button variant="outline" size="sm" onClick={handleRetry}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Reessayer
        </Button>
      </div>
    )
  }

  // Cancelled state
  if (status.status === 'cancelled') {
    if (compact) {
      return (
        <div className={cn('flex items-center gap-1.5', className)}>
          <AlertCircle className="h-4 w-4 text-yellow-500" />
          <span className="text-xs font-medium text-yellow-500">Annule</span>
        </div>
      )
    }

    return (
      <div className={cn('space-y-3', className)}>
        <div className="flex items-center gap-2 text-yellow-500">
          <AlertCircle className="h-5 w-5" />
          <span className="font-medium">Indexation annulee</span>
        </div>
        <Button variant="outline" size="sm" onClick={handleRetry}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Relancer
        </Button>
      </div>
    )
  }

  // In-progress states (pending, fetching, parsing, embedding)
  const progress = status.progress || 0
  const currentPhase = status.currentPhase || 'Initializing'
  const PhaseIcon = phaseConfig[currentPhase]?.icon || Loader2
  const phaseLabel = phaseConfig[currentPhase]?.label || currentPhase

  if (compact) {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        <Loader2 className="h-4 w-4 animate-spin text-pink-500" />
        <span className="text-xs font-medium text-pink-500">{progress}%</span>
      </div>
    )
  }

  return (
    <div className={cn('space-y-3', className)}>
      {/* Phase indicator */}
      <div className="flex items-center gap-2">
        <PhaseIcon className="h-4 w-4 animate-spin text-pink-500" />
        <span className="text-sm font-medium">{phaseLabel}</span>
      </div>

      {/* Progress bar */}
      <div className="space-y-1">
        <Progress value={progress} className="h-2" />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{progress}%</span>
          {/* {status.filesTotal !== undefined && status.filesProcessed !== undefined && (
            <span>
              {status.filesProcessed} / {status.filesTotal} fichiers
            </span>
          )} */}
        </div>
      </div>

      {/* Additional info */}
      {status.chunksCreated !== undefined && status.chunksCreated > 0 && (
        <p className="text-xs text-muted-foreground">
          {status.chunksCreated} sections creees
        </p>
      )}
    </div>
  )
}

// Badge variant for inline use
export function IndexingBadge({
  status,
  className,
}: {
  status: IndexingStatus
  className?: string
}) {
  const config: Record<IndexingStatus, { icon: typeof CheckCircle2; label: string; color: string }> = {
    not_started: { icon: Database, label: 'Non indexe', color: 'text-muted-foreground' },
    pending: { icon: Loader2, label: 'En attente', color: 'text-yellow-500' },
    fetching: { icon: Download, label: 'Telechargement', color: 'text-blue-500' },
    parsing: { icon: FileCode, label: 'Analyse', color: 'text-blue-500' },
    embedding: { icon: Cpu, label: 'Embeddings', color: 'text-purple-500' },
    completed: { icon: CheckCircle2, label: 'Indexe', color: 'text-green-500' },
    indexed: { icon: CheckCircle2, label: 'Indexe', color: 'text-green-500' },
    failed: { icon: XCircle, label: 'Echec', color: 'text-destructive' },
    cancelled: { icon: AlertCircle, label: 'Annule', color: 'text-yellow-500' },
  }

  const { icon: Icon, label, color } = config[status]
  const isAnimated = ['pending', 'fetching', 'parsing', 'embedding'].includes(status)

  return (
    <div className={cn('flex items-center gap-1.5', color, className)}>
      <Icon className={cn('h-3.5 w-3.5', isAnimated && 'animate-spin')} />
      <span className="text-xs font-medium">{label}</span>
    </div>
  )
}
