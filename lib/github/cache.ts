// Vercel KV cache layer for GitHub API responses
// Implements 5-minute TTL caching as per NFR10-11

import { kv } from '@vercel/kv'
import type { GitHubRepo } from './types'

const CACHE_TTL = 300 // 5 minutes in seconds

// Cache key patterns
const REPOS_KEY_PREFIX = 'repos:'

/**
 * Get cached repositories for a user
 * @param userId - The Supabase user ID
 * @returns Array of GitHubRepo or null if cache miss
 */
export async function getCachedRepos(userId: string): Promise<GitHubRepo[] | null> {
  try {
    const key = `${REPOS_KEY_PREFIX}${userId}`
    const cached = await kv.get<GitHubRepo[]>(key)
    return cached
  } catch (error) {
    // Log error but don't fail - cache miss is acceptable
    console.error('[Cache] Error getting cached repos:', error)
    return null
  }
}

/**
 * Cache repositories for a user
 * @param userId - The Supabase user ID
 * @param repos - Array of GitHubRepo to cache
 */
export async function setCachedRepos(userId: string, repos: GitHubRepo[]): Promise<void> {
  try {
    const key = `${REPOS_KEY_PREFIX}${userId}`
    await kv.set(key, repos, { ex: CACHE_TTL })
  } catch (error) {
    // Log error but don't fail - caching failure shouldn't break the app
    console.error('[Cache] Error caching repos:', error)
  }
}

/**
 * Invalidate cached repositories for a user
 * Useful when user connects/disconnects a repo
 * @param userId - The Supabase user ID
 */
export async function invalidateCachedRepos(userId: string): Promise<void> {
  try {
    const key = `${REPOS_KEY_PREFIX}${userId}`
    await kv.del(key)
  } catch (error) {
    console.error('[Cache] Error invalidating cached repos:', error)
  }
}
