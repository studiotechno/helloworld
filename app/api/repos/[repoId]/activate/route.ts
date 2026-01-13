import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getCurrentUser } from '@/lib/auth/sync-user'
import { logger } from '@/lib/logger'

const log = logger.api

interface RouteParams {
  params: Promise<{ repoId: string }>
}

// UUID validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * POST /api/repos/[repoId]/activate
 * Sets the specified repository as the active one for chat
 * without triggering a new indexation
 */
export async function POST(_req: Request, { params }: RouteParams) {
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

    // Verify the repository exists and belongs to the user
    const repository = await prisma.repositories.findFirst({
      where: {
        id: repoId,
        user_id: user.id,
      },
    })

    if (!repository) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Repository non trouve' } },
        { status: 404 }
      )
    }

    // Deactivate all other repos for this user
    await prisma.repositories.updateMany({
      where: {
        user_id: user.id,
        is_active: true,
        id: { not: repoId },
      },
      data: {
        is_active: false,
      },
    })

    // Activate the requested repo
    const updatedRepo = await prisma.repositories.update({
      where: { id: repoId },
      data: { is_active: true },
    })

    return NextResponse.json({ repository: updatedRepo })
  } catch (error) {
    log.error('Activate repo error', { error: error instanceof Error ? error.message : String(error) })

    return NextResponse.json(
      {
        error: {
          code: 'ACTIVATE_FAILED',
          message: 'Impossible d\'activer le repository',
        },
      },
      { status: 500 }
    )
  }
}
