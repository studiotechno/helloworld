import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fetchUserRepos } from '@/lib/github/client'
import { getCachedRepos, setCachedRepos } from '@/lib/github/cache'
import { getCurrentUser } from '@/lib/auth/sync-user'

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

    // Get GitHub token - prefer stored token, fallback to session
    let githubToken = user.github_token

    if (!githubToken) {
      // Try to get from session (available right after OAuth)
      const supabase = await createClient()
      const {
        data: { session },
      } = await supabase.auth.getSession()
      githubToken = session?.provider_token ?? null
    }

    if (!githubToken) {
      return NextResponse.json(
        { error: { code: 'GITHUB_TOKEN_MISSING', message: 'Token GitHub manquant. Veuillez vous reconnecter.' } },
        { status: 401 }
      )
    }

    // Use Prisma user ID for caching
    const userId = user.id

    // Check cache first
    const cached = await getCachedRepos(userId)
    if (cached) {
      return NextResponse.json(cached)
    }

    // Fetch from GitHub API
    const repos = await fetchUserRepos(githubToken)

    // Cache the result
    await setCachedRepos(userId, repos)

    return NextResponse.json(repos)
  } catch (error) {
    console.error('[API] Repos error:', error)

    // Handle specific GitHub API errors
    if (error instanceof Error) {
      if (error.message.includes('rate limit')) {
        return NextResponse.json(
          { error: { code: 'GITHUB_RATE_LIMIT', message: 'Limite d\'API GitHub atteinte. Reessayez dans quelques minutes.' } },
          { status: 429 }
        )
      }
      if (error.message.includes('Bad credentials')) {
        return NextResponse.json(
          { error: { code: 'GITHUB_AUTH_EXPIRED', message: 'Session GitHub expiree. Veuillez vous reconnecter.' } },
          { status: 401 }
        )
      }
    }

    return NextResponse.json(
      { error: { code: 'FETCH_FAILED', message: 'Impossible de charger les repositories' } },
      { status: 500 }
    )
  }
}
