/**
 * Indexation Job Manager
 *
 * Manages the lifecycle of code indexation jobs:
 * - Starting new jobs
 * - Tracking progress
 * - Handling errors and retries
 * - Cancellation
 */

import { prisma } from '../db/prisma'
import type { indexing_jobs } from '@prisma/client'

// Job status types
export type JobStatus =
  | 'pending'
  | 'fetching'
  | 'parsing'
  | 'embedding'
  | 'completed'
  | 'failed'
  | 'cancelled'

// Job phases for user-friendly display
export type JobPhase =
  | 'Initializing'
  | 'Fetching files'
  | 'Parsing code'
  | 'Generating embeddings'
  | 'Finalizing'

export interface IndexingJob {
  id: string
  repositoryId: string
  status: JobStatus
  progress: number
  filesTotal: number
  filesProcessed: number
  chunksCreated: number
  currentPhase: JobPhase | null
  errorMessage: string | null
  startedAt: Date | null
  completedAt: Date | null
  createdAt: Date
}

export interface JobProgress {
  filesTotal?: number
  filesProcessed?: number
  chunksCreated?: number
  progress?: number
  currentPhase?: JobPhase
}

export interface StartJobResult {
  jobId: string
  isNew: boolean
  existingStatus?: JobStatus
}

/**
 * Convert Prisma model to our interface
 */
function toIndexingJob(job: indexing_jobs): IndexingJob {
  return {
    id: job.id,
    repositoryId: job.repository_id,
    status: job.status as JobStatus,
    progress: job.progress,
    filesTotal: job.files_total,
    filesProcessed: job.files_processed,
    chunksCreated: job.chunks_created,
    currentPhase: job.current_phase as JobPhase | null,
    errorMessage: job.error_message,
    startedAt: job.started_at,
    completedAt: job.completed_at,
    createdAt: job.created_at,
  }
}

/**
 * Start a new indexation job for a repository
 * If a job already exists and is in progress, returns the existing job
 * If a previous job failed/completed, creates a new one
 */
export async function startIndexingJob(repositoryId: string): Promise<StartJobResult> {
  // Check for existing job
  const existingJob = await prisma.indexing_jobs.findUnique({
    where: { repository_id: repositoryId },
  })

  // If job exists and is in progress, return it
  if (existingJob) {
    const inProgressStatuses: JobStatus[] = ['pending', 'fetching', 'parsing', 'embedding']
    if (inProgressStatuses.includes(existingJob.status as JobStatus)) {
      return {
        jobId: existingJob.id,
        isNew: false,
        existingStatus: existingJob.status as JobStatus,
      }
    }

    // Job exists but is completed/failed/cancelled - delete and create new
    await prisma.indexing_jobs.delete({
      where: { id: existingJob.id },
    })
  }

  // Create new job
  const newJob = await prisma.indexing_jobs.create({
    data: {
      repository_id: repositoryId,
      status: 'pending',
      progress: 0,
      files_total: 0,
      files_processed: 0,
      chunks_created: 0,
      current_phase: 'Initializing',
    },
  })

  return {
    jobId: newJob.id,
    isNew: true,
  }
}

/**
 * Get the current status of an indexation job
 */
export async function getJobStatus(jobId: string): Promise<IndexingJob | null> {
  const job = await prisma.indexing_jobs.findUnique({
    where: { id: jobId },
  })

  if (!job) return null

  return toIndexingJob(job)
}

/**
 * Get job by repository ID
 */
export async function getJobByRepository(repositoryId: string): Promise<IndexingJob | null> {
  const job = await prisma.indexing_jobs.findUnique({
    where: { repository_id: repositoryId },
  })

  if (!job) return null

  return toIndexingJob(job)
}

/**
 * Update job progress
 */
export async function updateJobProgress(
  jobId: string,
  progress: JobProgress
): Promise<IndexingJob> {
  const updateData: Record<string, unknown> = {}

  if (progress.filesTotal !== undefined) {
    updateData.files_total = progress.filesTotal
  }
  if (progress.filesProcessed !== undefined) {
    updateData.files_processed = progress.filesProcessed
  }
  if (progress.chunksCreated !== undefined) {
    updateData.chunks_created = progress.chunksCreated
  }
  if (progress.progress !== undefined) {
    updateData.progress = Math.min(100, Math.max(0, progress.progress))
  }
  if (progress.currentPhase !== undefined) {
    updateData.current_phase = progress.currentPhase
  }

  const job = await prisma.indexing_jobs.update({
    where: { id: jobId },
    data: updateData,
  })

  return toIndexingJob(job)
}

/**
 * Transition job to a new status
 */
export async function updateJobStatus(
  jobId: string,
  status: JobStatus,
  options?: {
    phase?: JobPhase
    errorMessage?: string
  }
): Promise<IndexingJob> {
  const updateData: Record<string, unknown> = {
    status,
  }

  if (options?.phase) {
    updateData.current_phase = options.phase
  }

  if (options?.errorMessage) {
    updateData.error_message = options.errorMessage
  }

  // Set timestamps based on status
  if (status === 'fetching' || status === 'parsing' || status === 'embedding') {
    // Only set started_at if not already set
    const currentJob = await prisma.indexing_jobs.findUnique({
      where: { id: jobId },
    })
    if (currentJob && !currentJob.started_at) {
      updateData.started_at = new Date()
    }
  }

  if (status === 'completed' || status === 'failed' || status === 'cancelled') {
    updateData.completed_at = new Date()
    if (status === 'completed') {
      updateData.progress = 100
    }
  }

  const job = await prisma.indexing_jobs.update({
    where: { id: jobId },
    data: updateData,
  })

  return toIndexingJob(job)
}

/**
 * Mark job as started (fetching phase)
 */
export async function markJobStarted(
  jobId: string,
  filesTotal: number
): Promise<IndexingJob> {
  const job = await prisma.indexing_jobs.update({
    where: { id: jobId },
    data: {
      status: 'fetching',
      current_phase: 'Fetching files',
      files_total: filesTotal,
      started_at: new Date(),
    },
  })

  return toIndexingJob(job)
}

/**
 * Mark job as completed successfully
 */
export async function markJobCompleted(
  jobId: string,
  chunksCreated: number
): Promise<IndexingJob> {
  const job = await prisma.indexing_jobs.update({
    where: { id: jobId },
    data: {
      status: 'completed',
      progress: 100,
      chunks_created: chunksCreated,
      current_phase: null,
      completed_at: new Date(),
    },
  })

  return toIndexingJob(job)
}

/**
 * Mark job as failed with error message
 */
export async function markJobFailed(
  jobId: string,
  errorMessage: string
): Promise<IndexingJob> {
  const job = await prisma.indexing_jobs.update({
    where: { id: jobId },
    data: {
      status: 'failed',
      error_message: errorMessage,
      completed_at: new Date(),
    },
  })

  return toIndexingJob(job)
}

/**
 * Cancel an in-progress job
 */
export async function cancelJob(jobId: string): Promise<IndexingJob | null> {
  const job = await prisma.indexing_jobs.findUnique({
    where: { id: jobId },
  })

  if (!job) return null

  // Can only cancel jobs that are in progress
  const cancellableStatuses: JobStatus[] = ['pending', 'fetching', 'parsing', 'embedding']
  if (!cancellableStatuses.includes(job.status as JobStatus)) {
    return toIndexingJob(job)
  }

  const updatedJob = await prisma.indexing_jobs.update({
    where: { id: jobId },
    data: {
      status: 'cancelled',
      completed_at: new Date(),
    },
  })

  return toIndexingJob(updatedJob)
}

/**
 * Delete a job (cleanup)
 */
export async function deleteJob(jobId: string): Promise<boolean> {
  try {
    await prisma.indexing_jobs.delete({
      where: { id: jobId },
    })
    return true
  } catch {
    return false
  }
}

/**
 * Check if a job is in a terminal state
 */
export function isJobTerminal(status: JobStatus): boolean {
  return ['completed', 'failed', 'cancelled'].includes(status)
}

/**
 * Check if a job is in progress
 */
export function isJobInProgress(status: JobStatus): boolean {
  return ['pending', 'fetching', 'parsing', 'embedding'].includes(status)
}

/**
 * Calculate progress percentage based on files processed
 */
export function calculateProgress(
  filesProcessed: number,
  filesTotal: number,
  phase: JobPhase
): number {
  if (filesTotal === 0) return 0

  // Allocate progress across phases:
  // Fetching: 0-10%
  // Parsing: 10-50%
  // Embedding: 50-95%
  // Finalizing: 95-100%

  const fileProgress = filesProcessed / filesTotal

  switch (phase) {
    case 'Initializing':
      return 0
    case 'Fetching files':
      return Math.round(fileProgress * 10)
    case 'Parsing code':
      return 10 + Math.round(fileProgress * 40)
    case 'Generating embeddings':
      return 50 + Math.round(fileProgress * 45)
    case 'Finalizing':
      return 95
    default:
      return Math.round(fileProgress * 100)
  }
}

/**
 * Get all jobs for a user's repositories
 */
export async function getJobsForUser(userId: string): Promise<IndexingJob[]> {
  const jobs = await prisma.indexing_jobs.findMany({
    where: {
      repository: {
        user_id: userId,
      },
    },
    orderBy: {
      created_at: 'desc',
    },
  })

  return jobs.map(toIndexingJob)
}

/**
 * Get all in-progress jobs (for monitoring/cleanup)
 */
export async function getInProgressJobs(): Promise<IndexingJob[]> {
  const jobs = await prisma.indexing_jobs.findMany({
    where: {
      status: {
        in: ['pending', 'fetching', 'parsing', 'embedding'],
      },
    },
  })

  return jobs.map(toIndexingJob)
}

/**
 * Clean up stale jobs (jobs that have been in progress for too long)
 * This handles cases where the server crashed mid-indexation
 */
export async function cleanupStaleJobs(maxAgeMinutes: number = 30): Promise<number> {
  const cutoffTime = new Date(Date.now() - maxAgeMinutes * 60 * 1000)

  const result = await prisma.indexing_jobs.updateMany({
    where: {
      status: {
        in: ['pending', 'fetching', 'parsing', 'embedding'],
      },
      OR: [
        { started_at: { lt: cutoffTime } },
        { started_at: null, created_at: { lt: cutoffTime } },
      ],
    },
    data: {
      status: 'failed',
      error_message: 'Job timed out - please retry',
      completed_at: new Date(),
    },
  })

  return result.count
}
