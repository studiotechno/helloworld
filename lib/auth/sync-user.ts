import { prisma } from '@/lib/db/prisma'
import { createClient } from '@/lib/supabase/server'

interface GitHubUserMetadata {
  user_name?: string
  name?: string
  full_name?: string
  avatar_url?: string
  email?: string
  provider_id?: string
  sub?: string
}

/**
 * Syncs Supabase auth user with Prisma users table.
 * Creates user on first login, updates on subsequent logins.
 * Returns the Prisma user record.
 */
export async function syncUser() {
  const supabase = await createClient()

  const {
    data: { user: authUser },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !authUser) {
    console.error('[syncUser] No authenticated user:', authError)
    return null
  }

  // Extract GitHub metadata from Supabase user
  const metadata = authUser.user_metadata as GitHubUserMetadata
  const githubId = metadata.provider_id || metadata.sub || authUser.id

  // Get provider token from session (for GitHub API calls)
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const providerToken = session?.provider_token

  try {
    // Upsert user record in Prisma
    const user = await prisma.users.upsert({
      where: { github_id: githubId },
      update: {
        email: authUser.email,
        name: metadata.name || metadata.full_name || metadata.user_name,
        avatar_url: metadata.avatar_url,
        github_token: providerToken || undefined,
        updated_at: new Date(),
      },
      create: {
        github_id: githubId,
        email: authUser.email,
        name: metadata.name || metadata.full_name || metadata.user_name,
        avatar_url: metadata.avatar_url,
        github_token: providerToken || undefined,
      },
    })

    return user
  } catch (error) {
    console.error('[syncUser] Error upserting user:', error)
    return null
  }
}

/**
 * Gets the current Prisma user record for the authenticated user.
 * Does not create if doesn't exist.
 */
export async function getCurrentUser() {
  const supabase = await createClient()

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()

  if (!authUser) {
    return null
  }

  const metadata = authUser.user_metadata as GitHubUserMetadata
  const githubId = metadata.provider_id || metadata.sub || authUser.id

  try {
    const user = await prisma.users.findUnique({
      where: { github_id: githubId },
    })
    return user
  } catch (error) {
    console.error('[getCurrentUser] Error fetching user:', error)
    return null
  }
}
