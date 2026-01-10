import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/db/prisma'

export async function DELETE() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Non authentifié' } },
        { status: 401 }
      )
    }

    // Get GitHub ID from user metadata
    const metadata = user.user_metadata as {
      provider_id?: string
      sub?: string
    }
    const githubId = metadata.provider_id || metadata.sub

    if (!githubId) {
      return NextResponse.json(
        { error: { code: 'INVALID_USER', message: 'ID GitHub non trouvé' } },
        { status: 400 }
      )
    }

    // Delete user from database (cascade will handle related records)
    // Prisma schema has onDelete: Cascade for repositories and conversations
    try {
      await prisma.users.delete({
        where: { github_id: githubId },
      })
    } catch (dbError) {
      // User might not exist in Prisma DB (if DB not configured)
      // This is acceptable - just log and continue
      console.log('[API] User not found in database or DB not configured:', dbError)
    }

    // Sign out from Supabase to invalidate session
    await supabase.auth.signOut()

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[API] Delete account error:', error)
    return NextResponse.json(
      { error: { code: 'DELETE_FAILED', message: 'Échec de la suppression du compte' } },
      { status: 500 }
    )
  }
}
