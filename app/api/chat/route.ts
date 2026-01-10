import { streamText } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { getCurrentUser } from '@/lib/auth/sync-user'
import { prisma } from '@/lib/db/prisma'
import { z } from 'zod'
import { buildSystemPromptWithContext } from '@/lib/ai/prompts'

// Part schema for AI SDK v6 message format
// Accept any part type (text, tool_call, tool_result, etc.)
const partSchema = z.object({
  type: z.string(),
}).passthrough()

// Message schema supporting AI SDK v6 format (parts array)
// Using passthrough() to allow extra fields from the AI SDK that we don't need to validate
const messageSchema = z.object({
  id: z.string().optional(),
  role: z.enum(['user', 'assistant', 'system']),
  parts: z.array(partSchema).optional(),
  content: z.string().optional(),
}).passthrough()

// Request validation schema
// Note: conversationId can be null from the client, so we accept null and transform to undefined
const chatRequestSchema = z.object({
  messages: z.array(messageSchema),
  repoId: z.string().uuid().optional().nullable().transform(val => val ?? undefined),
  conversationId: z.string().uuid().optional().nullable().transform(val => val ?? undefined),
}).passthrough()

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

// System prompt is now built dynamically using lib/ai/prompts
// See lib/ai/prompts/base.ts and lib/ai/confidence.ts for the full prompt structure

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
      console.error('[API] Chat validation error:', JSON.stringify(parseResult.error.issues, null, 2))
      console.error('[API] Request body:', JSON.stringify(body, null, 2).substring(0, 1000))
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

    // Get repository context for the system prompt if available
    let repoContext: { name: string; branch: string } | undefined
    if (repoId) {
      const repository = await prisma.repositories.findFirst({
        where: { id: repoId, user_id: user.id },
        select: { full_name: true, default_branch: true },
      })
      if (repository) {
        repoContext = {
          name: repository.full_name,
          branch: repository.default_branch,
        }
      }
    }

    // Build the system prompt with confidence handling and repo context
    const systemPrompt = buildSystemPromptWithContext(repoContext)

    // Stream the response using Anthropic Claude
    const result = await streamText({
      model: anthropic('claude-sonnet-4-20250514'),
      messages,
      system: systemPrompt,
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
