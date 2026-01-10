import { z } from 'zod'

// Chat input validation schema
export const chatInputSchema = z.object({
  message: z.string().min(1, 'Message is required').max(4000, 'Message too long'),
  repoId: z.string().uuid('Invalid repository ID'),
  conversationId: z.string().uuid().optional(),
})

export type ChatInput = z.infer<typeof chatInputSchema>

// Chat message schema
export const messageSchema = z.object({
  id: z.string().uuid(),
  conversationId: z.string().uuid(),
  role: z.enum(['user', 'assistant']),
  content: z.string(),
  citations: z.array(
    z.object({
      file: z.string(),
      line: z.number().optional(),
      snippet: z.string().optional(),
    })
  ).default([]),
  createdAt: z.date(),
})

export type Message = z.infer<typeof messageSchema>

// Conversation schema
export const conversationSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  repositoryId: z.string().uuid(),
  title: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
})

export type Conversation = z.infer<typeof conversationSchema>
