import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getCurrentUser } from '@/lib/auth/sync-user'

export interface IndexingRepository {
  id: string
  github_repo_id: string
  full_name: string
  default_branch: string
  indexing: {
    jobId: string
    status: string
    progress: number
    filesTotal: number | null
    filesProcessed: number | null
    chunksCreated: number
    currentPhase: string | null
    error: string | null
    startedAt: string | null
  }
}

/**
 * GET /api/repos/indexing
 * Get all repositories currently being indexed (in-progress jobs)
 */
export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Non authentifie' } },
        { status: 401 }
      )
    }

    // Get all repos with in-progress indexing jobs
    const repositories = await prisma.repositories.findMany({
      where: {
        user_id: user.id,
        indexing_job: {
          status: {
            in: ['pending', 'fetching', 'parsing', 'embedding'],
          },
        },
      },
      include: {
        indexing_job: true,
      },
      orderBy: {
        created_at: 'desc',
      },
    })

    // Transform to response format
    const indexingRepos: IndexingRepository[] = repositories
      .filter((repo) => repo.indexing_job)
      .map((repo) => ({
        id: repo.id,
        github_repo_id: repo.github_repo_id,
        full_name: repo.full_name,
        default_branch: repo.default_branch,
        indexing: {
          jobId: repo.indexing_job!.id,
          status: repo.indexing_job!.status,
          progress: repo.indexing_job!.progress,
          filesTotal: repo.indexing_job!.files_total,
          filesProcessed: repo.indexing_job!.files_processed,
          chunksCreated: repo.indexing_job!.chunks_created,
          currentPhase: repo.indexing_job!.current_phase,
          error: repo.indexing_job!.error_message,
          startedAt: repo.indexing_job!.started_at?.toISOString() || null,
        },
      }))

    return NextResponse.json(indexingRepos)
  } catch (error) {
    console.error('[API] Get indexing repos error:', error)
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Erreur lors de la recuperation des repos en cours d\'indexation' } },
      { status: 500 }
    )
  }
}
