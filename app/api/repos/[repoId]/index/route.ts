import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getCurrentUser } from '@/lib/auth/sync-user'
import { logger } from '@/lib/logger'
import {
  startIndexingJob,
  cancelJob,
  getJobByRepository,
  isJobInProgress,
} from '@/lib/indexing'
import { runIndexationPipeline } from '@/lib/indexing/pipeline'

const log = logger.api

interface RouteParams {
  params: Promise<{ repoId: string }>
}

// UUID validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * POST /api/repos/[repoId]/index
 * Start indexation for a repository
 */
export async function POST(req: Request, { params }: RouteParams) {
  try {
    const { repoId } = await params

    // Validate UUID format
    if (!UUID_REGEX.test(repoId)) {
      return NextResponse.json(
        { error: { code: 'INVALID_ID', message: 'ID de repository invalide' } },
        { status: 400 }
      )
    }

    const user = await getCurrentUser()

    if (!user) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Non authentifie' } },
        { status: 401 }
      )
    }

    if (!user.github_token) {
      return NextResponse.json(
        {
          error: {
            code: 'NO_GITHUB_TOKEN',
            message: 'Token GitHub manquant. Veuillez vous reconnecter.',
          },
        },
        { status: 401 }
      )
    }

    // Verify the repository belongs to the user
    const repository = await prisma.repositories.findUnique({
      where: { id: repoId },
    })

    if (!repository) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Repository non trouve' } },
        { status: 404 }
      )
    }

    if (repository.user_id !== user.id) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Acces refuse' } },
        { status: 403 }
      )
    }

    // Check if there's already an indexing job in progress
    const existingJob = await getJobByRepository(repoId)
    if (existingJob && isJobInProgress(existingJob.status)) {
      return NextResponse.json({
        jobId: existingJob.id,
        status: existingJob.status,
        progress: existingJob.progress,
        message: 'Indexation deja en cours',
        statusUrl: `/api/repos/${repoId}/index/status`,
      })
    }

    // Start a new indexing job
    const { jobId, isNew } = await startIndexingJob(repoId)

    if (!isNew) {
      // Job exists but is not in progress (completed or failed) - start fresh
      const job = await getJobByRepository(repoId)
      return NextResponse.json({
        jobId,
        status: job?.status || 'pending',
        progress: job?.progress || 0,
        message: 'Job existant',
        statusUrl: `/api/repos/${repoId}/index/status`,
      })
    }

    // Parse owner/repo from full_name
    const [owner, repo] = repository.full_name.split('/')

    // Run the indexation pipeline in the background
    // We don't await this - it runs asynchronously
    runIndexationPipeline({
      accessToken: user.github_token,
      repositoryId: repoId,
      owner,
      repo,
      branch: repository.default_branch || undefined,
      jobId,
      userId: user.id,
      onProgress: async (phase, progress, message) => {
        // Progress updates are handled by the pipeline internally
        log.debug(`${phase} - ${progress}%`, { repoId, message })
      },
    }).catch(error => {
      log.error('Indexation failed', { repoId, error: error instanceof Error ? error.message : String(error) })
    })

    return NextResponse.json({
      jobId,
      status: 'pending',
      progress: 0,
      message: 'Indexation demarree',
      statusUrl: `/api/repos/${repoId}/index/status`,
    })
  } catch (error) {
    log.error('Start indexation error', { error: error instanceof Error ? error.message : String(error) })

    return NextResponse.json(
      {
        error: {
          code: 'INDEXATION_FAILED',
          message: 'Impossible de démarrer l\'indexation',
        },
      },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/repos/[repoId]/index
 * Cancel an ongoing indexation or delete a completed one
 * Query param: ?force=true to delete completed indexation
 */
export async function DELETE(req: Request, { params }: RouteParams) {
  try {
    const { repoId } = await params

    // Validate UUID format
    if (!UUID_REGEX.test(repoId)) {
      return NextResponse.json(
        { error: { code: 'INVALID_ID', message: 'ID de repository invalide' } },
        { status: 400 }
      )
    }

    const { searchParams } = new URL(req.url)
    const force = searchParams.get('force') === 'true'

    const user = await getCurrentUser()

    if (!user) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Non authentifie' } },
        { status: 401 }
      )
    }

    // Verify the repository belongs to the user
    const repository = await prisma.repositories.findUnique({
      where: { id: repoId },
    })

    if (!repository) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Repository non trouve' } },
        { status: 404 }
      )
    }

    if (repository.user_id !== user.id) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Acces refuse' } },
        { status: 403 }
      )
    }

    // Get the job
    const existingJob = await getJobByRepository(repoId)

    if (!existingJob) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Aucun job d\'indexation trouve' } },
        { status: 404 }
      )
    }

    // If job is in progress, cancel it
    if (isJobInProgress(existingJob.status)) {
      const cancelledJob = await cancelJob(existingJob.id)

      if (!cancelledJob) {
        return NextResponse.json(
          { error: { code: 'CANCEL_FAILED', message: 'Impossible d\'annuler le job' } },
          { status: 500 }
        )
      }

      return NextResponse.json({
        message: 'Indexation annulee',
        status: cancelledJob.status,
      })
    }

    // If force=true or job is completed/failed, delete everything
    if (force || existingJob.status === 'completed' || existingJob.status === 'failed') {
      // Delete all chunks for this repository
      const deletedChunks = await prisma.code_chunks.deleteMany({
        where: { repository_id: repoId },
      })

      // Delete the indexing job
      await prisma.indexing_jobs.delete({
        where: { id: existingJob.id },
      })

      return NextResponse.json({
        message: 'Indexation supprimee',
        chunksDeleted: deletedChunks.count,
      })
    }

    return NextResponse.json({
      message: 'Le job n\'est pas en cours',
      status: existingJob.status,
    })
  } catch (error) {
    log.error('Delete indexation error', { error: error instanceof Error ? error.message : String(error) })

    return NextResponse.json(
      {
        error: {
          code: 'DELETE_FAILED',
          message: 'Impossible de supprimer l\'indexation',
        },
      },
      { status: 500 }
    )
  }
}
