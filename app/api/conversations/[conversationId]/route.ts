import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getCurrentUser } from '@/lib/auth/sync-user'
import { z } from 'zod'

interface RouteParams {
  params: Promise<{
    conversationId: string
  }>
}

// Schema for PATCH request
const updateConversationSchema = z.object({
  title: z.string().min(1).max(200),
})

// PATCH - Update a conversation (rename)
export async function PATCH(req: Request, { params }: RouteParams) {
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

    // Parse and validate request body
    const body = await req.json()
    const parseResult = updateConversationSchema.safeParse(body)

    if (!parseResult.success) {
      return NextResponse.json(
        { error: { code: 'INVALID_REQUEST', message: 'Titre invalide' } },
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

    // Update the conversation title
    const updatedConversation = await prisma.conversations.update({
      where: {
        id: conversationId,
      },
      data: {
        title: parseResult.data.title,
        updated_at: new Date(),
      },
    })

    return NextResponse.json(updatedConversation)
  } catch (error) {
    console.error('[API] Update conversation error:', error)
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Erreur lors de la mise à jour de la conversation' } },
      { status: 500 }
    )
  }
}

// DELETE - Delete a conversation and its messages
export async function DELETE(req: Request, { params }: RouteParams) {
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

    // Delete the conversation (messages cascade automatically via foreign key)
    await prisma.conversations.delete({
      where: {
        id: conversationId,
      },
    })

    return new NextResponse(null, { status: 204 })
  } catch (error) {
    console.error('[API] Delete conversation error:', error)
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Erreur lors de la suppression de la conversation' } },
      { status: 500 }
    )
  }
}
