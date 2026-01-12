import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getCurrentUser } from '@/lib/auth/sync-user'

export interface IndexedRepository {
  id: string
  github_repo_id: string
  full_name: string
  default_branch: string
  is_active: boolean
  indexing: {
    status: string
    completedAt: string | null
    lastIndexedCommitSha: string | null
    lastIndexedCommitShort: string | null
    chunksCreated: number
  } | null
}

/**
 * GET /api/repos/indexed
 * Get all connected repositories with their indexing status
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

    // Get all connected repos with their indexing jobs
    const repositories = await prisma.repositories.findMany({
      where: {
        user_id: user.id,
      },
      include: {
        indexing_job: true,
      },
      orderBy: {
        created_at: 'desc',
      },
    })

    // Transform to response format
    const indexedRepos: IndexedRepository[] = repositories.map((repo) => ({
      id: repo.id,
      github_repo_id: repo.github_repo_id,
      full_name: repo.full_name,
      default_branch: repo.default_branch,
      is_active: repo.is_active,
      indexing: repo.indexing_job
        ? {
            status: repo.indexing_job.status,
            completedAt: repo.indexing_job.completed_at?.toISOString() || null,
            lastIndexedCommitSha: repo.indexing_job.last_indexed_commit_sha,
            lastIndexedCommitShort: repo.indexing_job.last_indexed_commit_sha?.substring(0, 7) || null,
            chunksCreated: repo.indexing_job.chunks_created,
          }
        : null,
    }))

    // Filter to only repos that have been indexed (have a completed job)
    const indexed = indexedRepos.filter(
      (repo) => repo.indexing?.status === 'completed'
    )

    return NextResponse.json(indexed)
  } catch (error) {
    console.error('[API] Get indexed repos error:', error)
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Erreur lors de la recuperation des repos indexes' } },
      { status: 500 }
    )
  }
}
