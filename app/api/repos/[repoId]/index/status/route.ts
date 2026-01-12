import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getCurrentUser } from '@/lib/auth/sync-user'
import { getJobByRepository, getRepositoryIndexStats, isRepositoryIndexed } from '@/lib/indexing'

interface RouteParams {
  params: Promise<{ repoId: string }>
}

/**
 * GET /api/repos/[repoId]/index/status
 * Get indexation status for a repository
 */
export async function GET(req: Request, { params }: RouteParams) {
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

    // Get the current job status
    const job = await getJobByRepository(repoId)

    if (!job) {
      // No job exists - check if there are existing chunks (already indexed)
      const isIndexed = await isRepositoryIndexed(repoId)

      if (isIndexed) {
        const stats = await getRepositoryIndexStats(repoId)
        return NextResponse.json({
          status: 'indexed',
          isIndexed: true,
          stats,
        })
      }

      return NextResponse.json({
        status: 'not_started',
        isIndexed: false,
        message: 'Aucune indexation en cours ou terminee',
      })
    }

    // Return job details
    const response: Record<string, unknown> = {
      jobId: job.id,
      status: job.status,
      progress: job.progress,
      filesTotal: job.filesTotal,
      filesProcessed: job.filesProcessed,
      chunksCreated: job.chunksCreated,
      currentPhase: job.currentPhase,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      isIndexed: job.status === 'completed',
    }

    // Add error message if failed
    if (job.status === 'failed' && job.errorMessage) {
      response.error = job.errorMessage
    }

    // Add stats if completed
    if (job.status === 'completed') {
      response.stats = await getRepositoryIndexStats(repoId)
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('[API] Get indexation status error:', error)

    return NextResponse.json(
      {
        error: {
          code: 'STATUS_FAILED',
          message: 'Impossible de recuperer le statut',
        },
      },
      { status: 500 }
    )
  }
}
