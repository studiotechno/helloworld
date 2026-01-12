import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getCurrentUser } from '@/lib/auth/sync-user'

interface RouteParams {
  params: Promise<{ repoId: string }>
}

/**
 * POST /api/repos/[repoId]/activate
 * Sets the specified repository as the active one for chat
 * without triggering a new indexation
 */
export async function POST(_req: Request, { params }: RouteParams) {
  try {
    const user = await getCurrentUser()

    if (!user) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Non authentifie' } },
        { status: 401 }
      )
    }

    const { repoId } = await params

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
    console.error('[API] Activate repo error:', error)

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
