import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getCurrentUser } from '@/lib/auth/sync-user'
import {
  startIndexingJob,
  cancelJob,
  getJobByRepository,
  isJobInProgress,
} from '@/lib/indexing'
import { runIndexationPipeline } from '@/lib/indexing/pipeline'

interface RouteParams {
  params: Promise<{ repoId: string }>
}

/**
 * POST /api/repos/[repoId]/index
 * Start indexation for a repository
 */
export async function POST(req: Request, { params }: RouteParams) {
  try {
    const { repoId } = await params
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
      onProgress: async (phase, progress, message) => {
        // Progress updates are handled by the pipeline internally
        console.log(`[Indexation] ${repoId}: ${phase} - ${progress}% - ${message}`)
      },
    }).catch(error => {
      console.error(`[Indexation] Failed for ${repoId}:`, error)
    })

    return NextResponse.json({
      jobId,
      status: 'pending',
      progress: 0,
      message: 'Indexation demarree',
      statusUrl: `/api/repos/${repoId}/index/status`,
    })
  } catch (error) {
    console.error('[API] Start indexation error:', error)

    return NextResponse.json(
      {
        error: {
          code: 'INDEXATION_FAILED',
          message: 'Impossible de demarrer l\'indexation',
        },
      },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/repos/[repoId]/index
 * Cancel an ongoing indexation
 */
export async function DELETE(req: Request, { params }: RouteParams) {
  try {
    const { repoId } = await params
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

    // Get and cancel the job
    const existingJob = await getJobByRepository(repoId)

    if (!existingJob) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Aucun job d\'indexation trouve' } },
        { status: 404 }
      )
    }

    if (!isJobInProgress(existingJob.status)) {
      return NextResponse.json({
        message: 'Le job n\'est pas en cours',
        status: existingJob.status,
      })
    }

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
  } catch (error) {
    console.error('[API] Cancel indexation error:', error)

    return NextResponse.json(
      {
        error: {
          code: 'CANCEL_FAILED',
          message: 'Impossible d\'annuler l\'indexation',
        },
      },
      { status: 500 }
    )
  }
}
