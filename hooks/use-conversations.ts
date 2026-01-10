import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

export interface Conversation {
  id: string
  user_id: string
  repository_id: string
  title: string | null
  created_at: string
  updated_at: string
  repository: {
    full_name: string
  }
  _count: {
    messages: number
  }
}

export interface Message {
  id: string
  conversation_id: string
  role: 'user' | 'assistant'
  content: string
  citations: unknown[]
  created_at: string
}

export interface ConversationWithMessages {
  conversation: {
    id: string
    title: string | null
    repository_id: string
  }
  messages: Message[]
}

/**
 * Hook to fetch all conversations for the current user
 */
export function useConversations() {
  return useQuery<Conversation[]>({
    queryKey: ['conversations'],
    queryFn: async () => {
      const response = await fetch('/api/conversations')
      if (!response.ok) {
        throw new Error('Failed to fetch conversations')
      }
      return response.json()
    },
  })
}

/**
 * Hook to fetch a single conversation with its messages
 */
export function useConversation(conversationId: string | null | undefined) {
  return useQuery<ConversationWithMessages>({
    queryKey: ['conversation', conversationId],
    queryFn: async () => {
      const response = await fetch(`/api/conversations/${conversationId}/messages`)
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Conversation non trouvee')
        }
        throw new Error('Failed to fetch conversation')
      }
      return response.json()
    },
    enabled: !!conversationId,
  })
}

/**
 * Hook to create a new conversation
 */
export function useCreateConversation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: { repositoryId: string; title?: string; firstMessage?: string }) => {
      const response = await fetch('/api/conversations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })
      if (!response.ok) {
        throw new Error('Failed to create conversation')
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
    },
  })
}
