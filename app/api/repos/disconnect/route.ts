import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getCurrentUser } from '@/lib/auth/sync-user'

export async function POST() {
  try {
    // Get authenticated Prisma user
    const user = await getCurrentUser()

    if (!user) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Non authentifie' } },
        { status: 401 }
      )
    }

    // Delete all user's active repositories (MVP = 1 repo)
    const deleted = await prisma.repositories.deleteMany({
      where: {
        user_id: user.id,
        is_active: true,
      },
    })

    if (deleted.count === 0) {
      return NextResponse.json(
        { error: { code: 'NO_REPO', message: 'Aucun repository connecte' } },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, deletedCount: deleted.count })
  } catch (error) {
    console.error('[API] Disconnect repo error:', error)

    return NextResponse.json(
      {
        error: {
          code: 'DISCONNECT_FAILED',
          message: 'Impossible de deconnecter le repository',
        },
      },
      { status: 500 }
    )
  }
}
