import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getCurrentUser } from '@/lib/auth/sync-user'
import { getJobByRepository, getRepositoryIndexStats, isRepositoryIndexed } from '@/lib/indexing'
import { fetchLatestCommitSha } from '@/lib/github/fetch-repository-files'

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

    // Verify the repository belongs to the user and get user's GitHub token
    const repository = await prisma.repositories.findUnique({
      where: { id: repoId },
      include: {
        user: {
          select: { github_token: true },
        },
      },
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

    // Parse owner/repo from full_name
    const [owner, repoName] = repository.full_name.split('/')
    const githubToken = repository.user.github_token

    // Helper to fetch latest commit (with error handling)
    const getLatestCommit = async (): Promise<string | null> => {
      if (!githubToken) return null
      try {
        return await fetchLatestCommitSha(
          githubToken,
          owner,
          repoName,
          repository.default_branch
        )
      } catch (error) {
        console.error('[API] Failed to fetch latest commit:', error)
        return null
      }
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

    // Add stats and commit info if completed
    if (job.status === 'completed') {
      response.stats = await getRepositoryIndexStats(repoId)

      // Add indexed commit info
      if (job.lastIndexedCommitSha) {
        response.lastIndexedCommitSha = job.lastIndexedCommitSha
        response.lastIndexedCommitShort = job.lastIndexedCommitSha.substring(0, 7)

        // Check if there's a newer commit
        const latestCommit = await getLatestCommit()
        if (latestCommit) {
          response.latestCommitSha = latestCommit
          response.latestCommitShort = latestCommit.substring(0, 7)
          response.hasNewerCommit = latestCommit !== job.lastIndexedCommitSha
        }
      }
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
