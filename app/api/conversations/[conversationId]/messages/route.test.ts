import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock prisma
vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    conversations: {
      findFirst: vi.fn(),
    },
    messages: {
      findMany: vi.fn(),
    },
  },
}))

// Mock auth
vi.mock('@/lib/auth/sync-user', () => ({
  getCurrentUser: vi.fn(),
}))

import { prisma } from '@/lib/db/prisma'
import { getCurrentUser } from '@/lib/auth/sync-user'
import { GET } from './route'

const mockUser = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  github_id: '12345',
  email: 'test@example.com',
  name: 'Test User',
}

const mockConversation = {
  id: '323e4567-e89b-12d3-a456-426614174002',
  user_id: mockUser.id,
  repository_id: '223e4567-e89b-12d3-a456-426614174001',
  title: 'Test conversation',
  created_at: new Date(),
  updated_at: new Date(),
}

const mockMessages = [
  {
    id: '423e4567-e89b-12d3-a456-426614174003',
    conversation_id: mockConversation.id,
    role: 'user',
    content: 'What is the tech stack?',
    citations: [],
    created_at: new Date('2026-01-09T10:00:00Z'),
  },
  {
    id: '523e4567-e89b-12d3-a456-426614174004',
    conversation_id: mockConversation.id,
    role: 'assistant',
    content: 'The tech stack includes Next.js, TypeScript, and Prisma.',
    citations: [],
    created_at: new Date('2026-01-09T10:00:05Z'),
  },
]

const createRequest = (conversationId: string) => {
  return new Request(`http://localhost/api/conversations/${conversationId}/messages`)
}

const createParams = (conversationId: string) => {
  return { params: Promise.resolve({ conversationId }) }
}

describe('GET /api/conversations/[conversationId]/messages', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return 401 if not authenticated', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null)

    const response = await GET(
      createRequest(mockConversation.id),
      createParams(mockConversation.id)
    )
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.error.code).toBe('UNAUTHORIZED')
  })

  it('should return 400 for invalid conversation ID', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser)

    const response = await GET(
      createRequest('invalid-id'),
      createParams('invalid-id')
    )
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error.code).toBe('INVALID_ID')
  })

  it('should return 404 if conversation not found', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser)
    vi.mocked(prisma.conversations.findFirst).mockResolvedValue(null)

    const response = await GET(
      createRequest(mockConversation.id),
      createParams(mockConversation.id)
    )
    const data = await response.json()

    expect(response.status).toBe(404)
    expect(data.error.code).toBe('CONVERSATION_NOT_FOUND')
  })

  it('should return 404 if conversation belongs to another user', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser)
    vi.mocked(prisma.conversations.findFirst).mockResolvedValue(null) // findFirst returns null because user_id doesn't match

    const response = await GET(
      createRequest(mockConversation.id),
      createParams(mockConversation.id)
    )
    const data = await response.json()

    expect(response.status).toBe(404)
    expect(data.error.code).toBe('CONVERSATION_NOT_FOUND')
    expect(prisma.conversations.findFirst).toHaveBeenCalledWith({
      where: {
        id: mockConversation.id,
        user_id: mockUser.id,
      },
    })
  })

  it('should return conversation with messages', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser)
    vi.mocked(prisma.conversations.findFirst).mockResolvedValue(mockConversation)
    vi.mocked(prisma.messages.findMany).mockResolvedValue(mockMessages)

    const response = await GET(
      createRequest(mockConversation.id),
      createParams(mockConversation.id)
    )
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.conversation.id).toBe(mockConversation.id)
    expect(data.messages).toHaveLength(2)
    expect(data.messages[0].role).toBe('user')
    expect(data.messages[1].role).toBe('assistant')
  })

  it('should return messages in chronological order', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser)
    vi.mocked(prisma.conversations.findFirst).mockResolvedValue(mockConversation)
    vi.mocked(prisma.messages.findMany).mockResolvedValue(mockMessages)

    await GET(
      createRequest(mockConversation.id),
      createParams(mockConversation.id)
    )

    expect(prisma.messages.findMany).toHaveBeenCalledWith({
      where: { conversation_id: mockConversation.id },
      orderBy: { created_at: 'asc' },
    })
  })

  it('should return empty messages array for new conversation', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser)
    vi.mocked(prisma.conversations.findFirst).mockResolvedValue(mockConversation)
    vi.mocked(prisma.messages.findMany).mockResolvedValue([])

    const response = await GET(
      createRequest(mockConversation.id),
      createParams(mockConversation.id)
    )
    const result = await response.json()

    expect(response.status).toBe(200)
    expect(result.messages).toEqual([])
  })
})
