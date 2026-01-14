import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getCurrentUser } from '@/lib/auth/sync-user'
import { z } from 'zod'
import { checkRepoLimit } from '@/lib/stripe'

// Request schema for connecting a repository
const connectRequestSchema = z.object({
  repoId: z.number(),
  fullName: z.string().regex(/^[^/]+\/[^/]+$/, 'Must be in owner/repo format'),
  defaultBranch: z.string().default('main'),
  size: z.number().optional(), // Size in KB from GitHub API
})

// Size threshold constant: ~500,000 lines ~ approximately 50MB
const SIZE_WARNING_THRESHOLD_KB = 50000

export async function POST(req: Request) {
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

    // Parse and validate request body
    const body = await req.json()
    const parseResult = connectRequestSchema.safeParse(body)

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Donnees invalides',
            details: parseResult.error.flatten(),
          },
        },
        { status: 400 }
      )
    }

    const { repoId, fullName, defaultBranch, size } = parseResult.data

    // Check if repo exceeds size threshold and return warning flag
    const exceedsSizeLimit = size ? size > SIZE_WARNING_THRESHOLD_KB : false

    // Check repo limit based on subscription plan
    const repoCheck = await checkRepoLimit(userId)

    // Check if this is a reconnection of an existing repo (doesn't count against limit)
    const existingRepo = await prisma.repositories.findUnique({
      where: {
        user_id_github_repo_id: {
          user_id: userId,
          github_repo_id: String(repoId),
        },
      },
    })

    // If not reconnecting and limit reached, block
    if (!existingRepo && !repoCheck.allowed) {
      return NextResponse.json(
        {
          error: {
            code: 'REPO_LIMIT_REACHED',
            message: 'Limite de repositories atteinte. Passez à un plan supérieur.',
            data: {
              current: repoCheck.current,
              limit: repoCheck.limit,
            },
          },
        },
        { status: 403 }
      )
    }

    // Deactivate other active repositories if limit is 1 (Free plan behavior)
    // For higher plans, keep other repos active
    if (repoCheck.limit === 1) {
      await prisma.repositories.updateMany({
        where: {
          user_id: userId,
          is_active: true,
        },
        data: {
          is_active: false,
        },
      })
    }

    // Connect the new repository (upsert to handle reconnecting same repo)
    const repository = await prisma.repositories.upsert({
      where: {
        user_id_github_repo_id: {
          user_id: userId,
          github_repo_id: String(repoId),
        },
      },
      create: {
        user_id: userId,
        github_repo_id: String(repoId),
        full_name: fullName,
        default_branch: defaultBranch,
        is_active: true,
        last_synced_at: new Date(),
      },
      update: {
        is_active: true,
        default_branch: defaultBranch,
        full_name: fullName,
        last_synced_at: new Date(),
      },
    })

    return NextResponse.json({
      repository,
      warning: exceedsSizeLimit
        ? {
            code: 'SIZE_WARNING',
            message:
              'Ce repository dépasse la limite recommandée pour le MVP (environ 10 000 lignes de code). Les performances peuvent être affectées.',
          }
        : null,
    })
  } catch (error) {
    console.error('[API] Connect repo error:', error)

    return NextResponse.json(
      {
        error: {
          code: 'CONNECT_FAILED',
          message: 'Impossible de connecter le repository',
        },
      },
      { status: 500 }
    )
  }
}
