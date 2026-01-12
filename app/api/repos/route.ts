import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fetchUserRepos } from '@/lib/github/client'
import { getCachedRepos, setCachedRepos, invalidateCachedRepos } from '@/lib/github/cache'
import { getCurrentUser } from '@/lib/auth/sync-user'

export async function GET(req: Request) {
  try {
    // Check for refresh param to bypass cache
    const { searchParams } = new URL(req.url)
    const forceRefresh = searchParams.get('refresh') === 'true'

    // Get authenticated Prisma user
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Non authentifie' } },
        { status: 401 }
      )
    }

    // Get GitHub token - prefer fresh session token, fallback to stored token
    const supabase = await createClient()
    const {
      data: { session },
    } = await supabase.auth.getSession()

    console.log('[API] Session provider_token exists:', !!session?.provider_token)
    console.log('[API] Stored github_token exists:', !!user.github_token)

    // Use session token if available (it has the latest scopes)
    let githubToken = session?.provider_token ?? user.github_token
    console.log('[API] Using token from:', session?.provider_token ? 'session' : 'database')

    if (!githubToken) {
      return NextResponse.json(
        { error: { code: 'GITHUB_TOKEN_MISSING', message: 'Token GitHub manquant. Veuillez vous reconnecter.' } },
        { status: 401 }
      )
    }

    // Update stored token if session has a fresh one
    if (session?.provider_token && session.provider_token !== user.github_token) {
      console.log('[API] Updating stored GitHub token with fresh session token')
      const { prisma } = await import('@/lib/db/prisma')
      await prisma.users.update({
        where: { id: user.id },
        data: { github_token: session.provider_token },
      })
    }

    // Use Prisma user ID for caching
    const userId = user.id

    // Invalidate cache if refresh requested
    if (forceRefresh) {
      await invalidateCachedRepos(userId)
    }

    // Check cache first (unless refresh requested)
    if (!forceRefresh) {
      const cached = await getCachedRepos(userId)
      if (cached) {
        return NextResponse.json(cached)
      }
    }

    // Fetch from GitHub API
    console.log('[API] Fetching repos from GitHub API...')
    const repos = await fetchUserRepos(githubToken)
    console.log(`[API] Fetched ${repos.length} repos from GitHub`)

    // Log org repos for debugging
    const orgRepos = repos.filter(r => r.full_name.includes('/') && !r.full_name.startsWith(user.name || ''))
    console.log(`[API] Found ${orgRepos.length} potential org repos`)

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
