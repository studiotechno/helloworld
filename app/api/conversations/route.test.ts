import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock prisma
vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    repositories: {
      findFirst: vi.fn(),
    },
    conversations: {
      create: vi.fn(),
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
import { POST, GET } from './route'

const mockUser = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  github_id: '12345',
  email: 'test@example.com',
  name: 'Test User',
}

const mockRepository = {
  id: '223e4567-e89b-12d3-a456-426614174001',
  user_id: mockUser.id,
  github_repo_id: '67890',
  full_name: 'user/repo',
  default_branch: 'main',
  is_active: true,
}

const mockConversation = {
  id: '323e4567-e89b-12d3-a456-426614174002',
  user_id: mockUser.id,
  repository_id: mockRepository.id,
  title: 'Test conversation',
  created_at: new Date(),
  updated_at: new Date(),
}

describe('POST /api/conversations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return 401 if not authenticated', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null)

    const request = new Request('http://localhost/api/conversations', {
      method: 'POST',
      body: JSON.stringify({ repositoryId: mockRepository.id }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.error.code).toBe('UNAUTHORIZED')
  })

  it('should return 400 for invalid request body', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser)

    const request = new Request('http://localhost/api/conversations', {
      method: 'POST',
      body: JSON.stringify({ repositoryId: 'not-a-uuid' }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error.code).toBe('INVALID_REQUEST')
  })

  it('should return 404 if repository not found', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser)
    vi.mocked(prisma.repositories.findFirst).mockResolvedValue(null)

    const request = new Request('http://localhost/api/conversations', {
      method: 'POST',
      body: JSON.stringify({ repositoryId: mockRepository.id }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(404)
    expect(data.error.code).toBe('REPOSITORY_NOT_FOUND')
  })

  it('should create conversation successfully', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser)
    vi.mocked(prisma.repositories.findFirst).mockResolvedValue(mockRepository)
    vi.mocked(prisma.conversations.create).mockResolvedValue(mockConversation)

    const request = new Request('http://localhost/api/conversations', {
      method: 'POST',
      body: JSON.stringify({
        repositoryId: mockRepository.id,
        firstMessage: 'Hello, tell me about this code',
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(201)
    expect(data.id).toBe(mockConversation.id)
    expect(prisma.conversations.create).toHaveBeenCalledWith({
      data: {
        user_id: mockUser.id,
        repository_id: mockRepository.id,
        title: 'Hello, tell me about this code',
      },
    })
  })

  it('should auto-generate title from long first message', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser)
    vi.mocked(prisma.repositories.findFirst).mockResolvedValue(mockRepository)
    vi.mocked(prisma.conversations.create).mockResolvedValue(mockConversation)

    const longMessage = 'This is a very long message that should be truncated to fifty characters for the title'
    const request = new Request('http://localhost/api/conversations', {
      method: 'POST',
      body: JSON.stringify({
        repositoryId: mockRepository.id,
        firstMessage: longMessage,
      }),
    })

    await POST(request)

    // The title should be truncated at word boundary and end with ...
    expect(prisma.conversations.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        title: 'This is a very long message that should be...',
      }),
    })
  })
})

describe('GET /api/conversations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return 401 if not authenticated', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null)

    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.error.code).toBe('UNAUTHORIZED')
  })

  it('should return user conversations', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser)
    vi.mocked(prisma.conversations.findMany).mockResolvedValue([
      {
        ...mockConversation,
        repository: { full_name: 'user/repo' },
        _count: { messages: 5 },
      },
    ])

    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toHaveLength(1)
    expect(data[0].id).toBe(mockConversation.id)
    expect(prisma.conversations.findMany).toHaveBeenCalledWith({
      where: { user_id: mockUser.id },
      orderBy: { updated_at: 'desc' },
      include: expect.any(Object),
    })
  })

  it('should return empty array if no conversations', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser)
    vi.mocked(prisma.conversations.findMany).mockResolvedValue([])

    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toEqual([])
  })
})
