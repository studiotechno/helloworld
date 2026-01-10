import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getCurrentUser } from '@/lib/auth/sync-user'

export async function GET() {
  try {
    // Get authenticated Prisma user (uses getUser() internally)
    const user = await getCurrentUser()

    if (!user) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Non authentifie' } },
        { status: 401 }
      )
    }

    const userId = user.id

    // Get the user's active repository
    const activeRepo = await prisma.repositories.findFirst({
      where: {
        user_id: userId,
        is_active: true,
      },
    })

    // Return null if no active repository (not an error)
    if (!activeRepo) {
      return NextResponse.json({ repository: null })
    }

    return NextResponse.json({ repository: activeRepo })
  } catch (error) {
    console.error('[API] Active repo error:', error)

    return NextResponse.json(
      {
        error: {
          code: 'FETCH_FAILED',
          message: 'Impossible de recuperer le repository actif',
        },
      },
      { status: 500 }
    )
  }
}
