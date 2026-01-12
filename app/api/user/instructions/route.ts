import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getCurrentUser } from '@/lib/auth/sync-user'
import { z } from 'zod'

// Validation schema for instructions update
const instructionsSchema = z.object({
  profile_instructions: z.string().max(2000).nullable().optional(),
  team_instructions: z.string().max(2000).nullable().optional(),
})

/**
 * GET /api/user/instructions
 * Retrieves the user's personalized instructions
 */
export async function GET() {
  try {
    const user = await getCurrentUser()

    if (!user) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Non authentifie' } },
        { status: 401 }
      )
    }

    const instructions = await prisma.user_instructions.findUnique({
      where: { user_id: user.id },
    })

    // Return empty object if no instructions exist yet
    return NextResponse.json({
      instructions: instructions
        ? {
            profile_instructions: instructions.profile_instructions,
            team_instructions: instructions.team_instructions,
          }
        : {
            profile_instructions: null,
            team_instructions: null,
          },
    })
  } catch (error) {
    console.error('[API] Get instructions error:', error)
    return NextResponse.json(
      {
        error: {
          code: 'FETCH_FAILED',
          message: 'Impossible de recuperer les instructions',
        },
      },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/user/instructions
 * Updates the user's personalized instructions
 */
export async function PUT(request: Request) {
  try {
    const user = await getCurrentUser()

    if (!user) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Non authentifie' } },
        { status: 401 }
      )
    }

    const body = await request.json()
    const parsed = instructionsSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Donnees invalides',
            details: parsed.error.flatten(),
          },
        },
        { status: 400 }
      )
    }

    const { profile_instructions, team_instructions } = parsed.data

    // Upsert: create if doesn't exist, update if it does
    const instructions = await prisma.user_instructions.upsert({
      where: { user_id: user.id },
      update: {
        profile_instructions: profile_instructions ?? undefined,
        team_instructions: team_instructions ?? undefined,
        updated_at: new Date(),
      },
      create: {
        user_id: user.id,
        profile_instructions: profile_instructions ?? null,
        team_instructions: team_instructions ?? null,
      },
    })

    return NextResponse.json({
      instructions: {
        profile_instructions: instructions.profile_instructions,
        team_instructions: instructions.team_instructions,
      },
    })
  } catch (error) {
    console.error('[API] Update instructions error:', error)
    return NextResponse.json(
      {
        error: {
          code: 'UPDATE_FAILED',
          message: 'Impossible de mettre a jour les instructions',
        },
      },
      { status: 500 }
    )
  }
}
