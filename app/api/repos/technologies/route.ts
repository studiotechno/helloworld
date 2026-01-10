import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth/sync-user'
import { fetchRepoLanguages } from '@/lib/github/client'

export async function GET() {
  try {
    // Get authenticated Prisma user
    const user = await getCurrentUser()

    if (!user) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Non authentifie' } },
        { status: 401 }
      )
    }

    // Get the user's active repository
    const activeRepo = await prisma.repositories.findFirst({
      where: {
        user_id: user.id,
        is_active: true,
      },
    })

    if (!activeRepo) {
      return NextResponse.json({ technologies: [] })
    }

    // Get GitHub token - prefer stored token, fallback to session
    let githubToken = user.github_token

    if (!githubToken) {
      const supabase = await createClient()
      const {
        data: { session },
      } = await supabase.auth.getSession()
      githubToken = session?.provider_token ?? null
    }

    if (!githubToken) {
      return NextResponse.json(
        { error: { code: 'NO_GITHUB_TOKEN', message: 'Token GitHub non disponible' } },
        { status: 401 }
      )
    }

    // Parse owner/repo from full_name
    const [owner, repo] = activeRepo.full_name.split('/')

    // Fetch languages from GitHub API
    const languages = await fetchRepoLanguages(githubToken, owner, repo)

    return NextResponse.json({ technologies: languages })
  } catch (error) {
    console.error('[API] Technologies error:', error)

    return NextResponse.json(
      {
        error: {
          code: 'FETCH_FAILED',
          message: 'Impossible de recuperer les technologies',
        },
      },
      { status: 500 }
    )
  }
}
