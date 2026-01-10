import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getCurrentUser } from '@/lib/auth/sync-user'

interface RouteParams {
  params: Promise<{
    conversationId: string
  }>
}

// GET - Fetch all messages for a conversation
export async function GET(req: Request, { params }: RouteParams) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Non authentifie' } },
        { status: 401 }
      )
    }

    const { conversationId } = await params

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(conversationId)) {
      return NextResponse.json(
        { error: { code: 'INVALID_ID', message: 'ID de conversation invalide' } },
        { status: 400 }
      )
    }

    // Verify conversation belongs to user
    const conversation = await prisma.conversations.findFirst({
      where: {
        id: conversationId,
        user_id: user.id,
      },
    })

    if (!conversation) {
      return NextResponse.json(
        { error: { code: 'CONVERSATION_NOT_FOUND', message: 'Conversation non trouvee' } },
        { status: 404 }
      )
    }

    // Fetch messages ordered by creation time
    const messages = await prisma.messages.findMany({
      where: {
        conversation_id: conversationId,
      },
      orderBy: {
        created_at: 'asc',
      },
    })

    return NextResponse.json({
      conversation,
      messages,
    })
  } catch (error) {
    console.error('[API] Fetch messages error:', error)
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Erreur lors de la recuperation des messages' } },
      { status: 500 }
    )
  }
}
