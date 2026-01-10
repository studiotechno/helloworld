import { streamText } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { getCurrentUser } from '@/lib/auth/sync-user'
import { prisma } from '@/lib/db/prisma'
import { z } from 'zod'

// Text part schema for AI SDK v6 message format
const textPartSchema = z.object({
  type: z.literal('text'),
  text: z.string(),
})

// Message schema supporting AI SDK v6 format (parts array)
const messageSchema = z.object({
  id: z.string().optional(),
  role: z.enum(['user', 'assistant', 'system']),
  parts: z.array(textPartSchema).optional(),
  content: z.string().optional(),
})

// Request validation schema
const chatRequestSchema = z.object({
  messages: z.array(messageSchema),
  repoId: z.string().uuid().optional(),
  conversationId: z.string().uuid().optional(),
})

// Helper to extract text content from a message (supports both v6 parts and legacy content)
function getMessageContent(message: z.infer<typeof messageSchema>): string {
  if (message.content) {
    return message.content
  }
  if (message.parts) {
    return message.parts
      .filter((part): part is { type: 'text'; text: string } => part.type === 'text')
      .map((part) => part.text)
      .join('')
  }
  return ''
}

// Helper to generate title from first message
function generateTitle(content: string): string {
  const maxLength = 50
  if (content.length <= maxLength) return content
  const truncated = content.substring(0, maxLength)
  const lastSpace = truncated.lastIndexOf(' ')
  return (lastSpace > 0 ? truncated.substring(0, lastSpace) : truncated) + '...'
}

// System prompt for the codebase assistant
const SYSTEM_PROMPT = `Tu es un assistant expert qui aide les Product Managers et entrepreneurs non-techniques a comprendre leur codebase.

Ton role:
- Repondre aux questions sur le code en langage naturel
- Expliquer les concepts techniques de maniere pedagogique et accessible
- Utiliser un vocabulaire professionnel adapte aux PMs (pas de vulgarisation excessive)
- Citer les fichiers sources pertinents quand tu fais reference au code

Regles importantes:
- Reponds toujours en francais
- Si tu n'es pas certain d'une reponse, dis-le clairement: "Je ne suis pas en mesure de repondre avec certitude a cette question"
- Ne dis jamais "peut-etre" ou "probablement" avec un pourcentage de confiance
- Sois concis par defaut, mais developpe si la question est complexe
- Formate tes reponses avec du markdown pour la lisibilite`

export async function POST(req: Request) {
  try {
    // Authenticate user
    const user = await getCurrentUser()
    if (!user) {
      return new Response(
        JSON.stringify({ error: { code: 'UNAUTHORIZED', message: 'Non authentifie' } }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Parse and validate request body
    const body = await req.json()
    const parseResult = chatRequestSchema.safeParse(body)

    if (!parseResult.success) {
      return new Response(
        JSON.stringify({
          error: {
            code: 'INVALID_REQUEST',
            message: 'Format de requete invalide',
            details: parseResult.error.issues,
          },
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const { messages: rawMessages, repoId, conversationId: existingConversationId } = parseResult.data

    // Convert messages to the format expected by streamText
    const messages = rawMessages.map((msg) => ({
      role: msg.role,
      content: getMessageContent(msg),
    }))

    // Get the last user message for persistence
    const lastUserMessage = [...rawMessages].reverse().find((m) => m.role === 'user')
    const lastUserContent = lastUserMessage ? getMessageContent(lastUserMessage) : ''

    // Handle conversation persistence
    let conversationId = existingConversationId

    if (!conversationId && repoId) {
      // Get active repository
      const repository = await prisma.repositories.findFirst({
        where: {
          id: repoId,
          user_id: user.id,
        },
      })

      if (repository) {
        // Create new conversation
        const conversation = await prisma.conversations.create({
          data: {
            user_id: user.id,
            repository_id: repository.id,
            title: generateTitle(lastUserContent),
          },
        })
        conversationId = conversation.id
      }
    }

    // Save user message if we have a conversation
    if (conversationId && lastUserContent) {
      await prisma.messages.create({
        data: {
          conversation_id: conversationId,
          role: 'user',
          content: lastUserContent,
        },
      })

      // Update conversation timestamp
      await prisma.conversations.update({
        where: { id: conversationId },
        data: { updated_at: new Date() },
      })
    }

    // Stream the response using Anthropic Claude
    const result = await streamText({
      model: anthropic('claude-sonnet-4-20250514'),
      messages,
      system: SYSTEM_PROMPT,
      maxOutputTokens: 4096,
      onFinish: async ({ text }) => {
        // Save assistant message after streaming completes
        if (conversationId && text) {
          await prisma.messages.create({
            data: {
              conversation_id: conversationId,
              role: 'assistant',
              content: text,
            },
          })

          // Update conversation timestamp
          await prisma.conversations.update({
            where: { id: conversationId },
            data: { updated_at: new Date() },
          })
        }
      },
    })

    // Create response with conversation ID header
    const response = result.toUIMessageStreamResponse()

    // Add conversation ID to response headers
    if (conversationId) {
      response.headers.set('X-Conversation-Id', conversationId)
    }

    return response
  } catch (error) {
    console.error('[API] Chat error:', error)

    // Handle specific error types
    if (error instanceof Error) {
      // Rate limit error
      if (error.message.includes('rate') || error.message.includes('429')) {
        return new Response(
          JSON.stringify({
            error: {
              code: 'RATE_LIMITED',
              message: 'Trop de requetes. Veuillez patienter quelques instants.',
            },
          }),
          { status: 429, headers: { 'Content-Type': 'application/json' } }
        )
      }

      // API key error
      if (error.message.includes('API key') || error.message.includes('401')) {
        return new Response(
          JSON.stringify({
            error: {
              code: 'API_ERROR',
              message: 'Erreur de configuration. Veuillez contacter le support.',
            },
          }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        )
      }
    }

    // Generic error
    return new Response(
      JSON.stringify({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Une erreur est survenue. Veuillez reessayer.',
        },
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
