import { streamText } from 'ai'
import { getCurrentUser } from '@/lib/auth/sync-user'
import { prisma } from '@/lib/db/prisma'
import { z } from 'zod'
import { buildSystemPromptWithContext } from '@/lib/ai/prompts'
import { isRepositoryIndexed } from '@/lib/indexing'
import {
  smartRetrieve,
  getRetrievalSummary,
  buildCodeContext,
  extractCitations,
  type RetrievedChunk,
} from '@/lib/rag'
import { getModelForQuery, logRouting } from '@/lib/ai'

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

    // If we have an existing conversation, load previous messages from DB
    // Optimization: Limit to last 10 messages (5 exchanges) to reduce token usage
    const MAX_HISTORY_MESSAGES = 10
    let conversationHistory: { role: 'user' | 'assistant' | 'system'; content: string }[] = []
    if (existingConversationId) {
      const previousMessages = await prisma.messages.findMany({
        where: { conversation_id: existingConversationId },
        orderBy: { created_at: 'desc' }, // Get most recent first
        take: MAX_HISTORY_MESSAGES,
        select: { role: true, content: true },
      })
      // Reverse to get chronological order
      conversationHistory = previousMessages.reverse().map((msg) => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      }))
    }

    // Convert new messages from request to the format expected by streamText
    const newMessages = rawMessages.map((msg) => ({
      role: msg.role,
      content: getMessageContent(msg),
    }))

    // Combine history + new messages (avoid duplicates by only adding truly new messages)
    // The new messages from client might already be in history if this is a retry
    const historyContents = new Set(conversationHistory.map(m => m.content))
    const uniqueNewMessages = newMessages.filter(m => !historyContents.has(m.content))

    const messages = [...conversationHistory, ...uniqueNewMessages]

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

    // Get user instructions for personalized responses
    const userInstructions = await prisma.user_instructions.findUnique({
      where: { user_id: user.id },
      select: { profile_instructions: true, team_instructions: true },
    })

    // RAG: Retrieve relevant code chunks if repository is indexed
    let codeContext = ''
    let retrievedChunks: RetrievedChunk[] = []
    let isIndexed = false

    if (repoId) {
      try {
        isIndexed = await isRepositoryIndexed(repoId)

        if (isIndexed && lastUserContent) {
          // Use smart retrieval to find relevant code based on user's question
          // This automatically selects the best strategy:
          // - Metadata-based for "list all X" queries (exhaustive results)
          // - Vector search for specific questions (semantic matching)
          // - Hybrid for detected types that aren't list queries
          // Optimization: Reduced limits to save tokens while maintaining quality
          const retrievalResult = await smartRetrieve(lastUserContent, repoId, {
            vectorLimit: 15,      // Was 30 - still good semantic coverage
            metadataLimit: 50,    // Was 100 - sufficient for list queries
          })
          retrievedChunks = retrievalResult.chunks

          // Log retrieval strategy for debugging
          console.log('[API]', getRetrievalSummary(retrievalResult))

          if (retrievedChunks.length > 0) {
            // Build formatted context for the LLM
            // Optimization: Reduced from 25000 to 10000 tokens
            const contextResult = buildCodeContext(retrievedChunks, {
              maxTokens: 10000,
              groupByFile: true,
              language: 'fr',
            })
            codeContext = contextResult.context

            // Log token usage for monitoring
            console.log(`[API] Context: ${contextResult.chunksIncluded}/${contextResult.chunksTotal} chunks, ~${contextResult.estimatedTokens} tokens`)
          }
        }
      } catch (error) {
        // Log but don't fail the request if RAG fails
        console.error('[API] RAG retrieval error:', error)
      }
    }

    // Build the system prompt with confidence handling, repo context, and user instructions
    let systemPrompt = buildSystemPromptWithContext(repoContext, userInstructions ?? undefined)

    // Add code context to system prompt if available
    if (codeContext) {
      systemPrompt += `\n\n${codeContext}`
    } else if (repoId && !isIndexed) {
      // Inform Claude that indexing is not complete
      systemPrompt += `\n\n## Note sur l'indexation

Le repository n'est pas encore indexe. Tu ne disposes pas du contexte du code source.
Reponds du mieux possible en te basant sur les informations generales, et suggere a l'utilisateur de patienter pendant l'indexation.`
    } else if (repoId && isIndexed && retrievedChunks.length === 0) {
      // Indexed but no relevant code found for this query
      systemPrompt += `\n\n## Contexte code

Aucun code pertinent n'a ete trouve pour cette question dans le repository indexe.
NE REPONDS PAS avec des exemples generiques ou inventes. Dis simplement que tu n'as pas trouve cette information dans le code.`
    }

    // Route to appropriate model based on query complexity
    // Estimate context tokens (roughly 4 chars per token)
    const estimatedContextTokens = Math.ceil(codeContext.length / 4)
    const { model, analysis } = getModelForQuery(lastUserContent, estimatedContextTokens)

    // Log routing decision
    logRouting(analysis, lastUserContent)
    console.log(`[API] [ModelRouter] Using ${analysis.model.toUpperCase()} (context: ~${estimatedContextTokens} tokens)`)

    // Stream the response using the selected model
    // Optimization: Reduced maxOutputTokens from 4096 to 2048
    const result = await streamText({
      model,
      messages,
      system: systemPrompt,
      maxOutputTokens: 2048,
      onFinish: async ({ text }) => {
        // Save assistant message after streaming completes
        if (conversationId && text) {
          // Extract citations from retrieved chunks
          const citations = retrievedChunks.length > 0
            ? extractCitations(retrievedChunks)
            : []

          await prisma.messages.create({
            data: {
              conversation_id: conversationId,
              role: 'assistant',
              content: text,
              citations: citations,
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

    // Add indexing status headers
    if (repoId) {
      response.headers.set('X-Repository-Indexed', isIndexed ? 'true' : 'false')
      response.headers.set('X-Code-Chunks-Used', String(retrievedChunks.length))
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
