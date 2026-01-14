import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getCurrentUser } from '@/lib/auth/sync-user'
import { z } from 'zod'

// Request validation schema for creating a conversation
const createConversationSchema = z.object({
  repositoryId: z.string().uuid(),
  title: z.string().optional(),
  firstMessage: z.string().optional(),
})

// Helper to generate title from first message
function generateTitle(content: string): string {
  const maxLength = 50
  if (content.length <= maxLength) return content
  const truncated = content.substring(0, maxLength)
  const lastSpace = truncated.lastIndexOf(' ')
  return (lastSpace > 0 ? truncated.substring(0, lastSpace) : truncated) + '...'
}

// POST - Create a new conversation
export async function POST(req: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Non authentifie' } },
        { status: 401 }
      )
    }

    const body = await req.json()
    const parseResult = createConversationSchema.safeParse(body)

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: {
            code: 'INVALID_REQUEST',
            message: 'Format de requete invalide',
            details: parseResult.error.issues,
          },
        },
        { status: 400 }
      )
    }

    const { repositoryId, title, firstMessage } = parseResult.data

    // Verify repository belongs to user
    const repository = await prisma.repositories.findFirst({
      where: {
        id: repositoryId,
        user_id: user.id,
      },
    })

    if (!repository) {
      return NextResponse.json(
        { error: { code: 'REPOSITORY_NOT_FOUND', message: 'Repository non trouve' } },
        { status: 404 }
      )
    }

    // Generate title from first message if not provided
    const conversationTitle = title || (firstMessage ? generateTitle(firstMessage) : null)

    // Create the conversation
    const conversation = await prisma.conversations.create({
      data: {
        user_id: user.id,
        repository_id: repositoryId,
        title: conversationTitle,
      },
    })

    return NextResponse.json(conversation, { status: 201 })
  } catch (error) {
    console.error('[API] Create conversation error:', error)
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Erreur lors de la création de la conversation' } },
      { status: 500 }
    )
  }
}

// GET - List user's conversations
// Optional query param: ?repositoryId=xxx to filter by repository
export async function GET(req: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Non authentifie' } },
        { status: 401 }
      )
    }

    // Parse optional repositoryId filter
    const { searchParams } = new URL(req.url)
    const repositoryId = searchParams.get('repositoryId')

    const conversations = await prisma.conversations.findMany({
      where: {
        user_id: user.id,
        ...(repositoryId && { repository_id: repositoryId }),
      },
      orderBy: {
        updated_at: 'desc',
      },
      include: {
        repository: {
          select: {
            full_name: true,
          },
        },
        _count: {
          select: {
            messages: true,
          },
        },
      },
    })

    return NextResponse.json(conversations)
  } catch (error) {
    console.error('[API] List conversations error:', error)
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Erreur lors de la recuperation des conversations' } },
      { status: 500 }
    )
  }
}
