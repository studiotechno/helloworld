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
 * Hook to fetch conversations for the current user
 * @param repositoryId - Repository ID to filter conversations (undefined = not loaded yet, null = no repo)
 */
export function useConversations(repositoryId?: string | null) {
  return useQuery<Conversation[]>({
    queryKey: ['conversations', repositoryId ?? 'none'],
    queryFn: async () => {
      // If no repository selected, return empty array
      if (!repositoryId) {
        return []
      }
      const response = await fetch(`/api/conversations?repositoryId=${repositoryId}`)
      if (!response.ok) {
        throw new Error('Failed to fetch conversations')
      }
      return response.json()
    },
    // Only fetch when repositoryId is defined (even if null)
    enabled: repositoryId !== undefined,
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

/**
 * Hook to delete a conversation
 */
export function useDeleteConversation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (conversationId: string) => {
      const response = await fetch(`/api/conversations/${conversationId}`, {
        method: 'DELETE',
      })
      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new Error(error?.error?.message || 'Failed to delete conversation')
      }
    },
    onMutate: async (conversationId: string) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['conversations'] })

      // Snapshot the previous value
      const previousConversations = queryClient.getQueryData<Conversation[]>(['conversations'])

      // Optimistically update
      queryClient.setQueryData<Conversation[]>(['conversations'], (old) =>
        old?.filter((c) => c.id !== conversationId)
      )

      return { previousConversations }
    },
    onError: (_err, _conversationId, context) => {
      // Rollback on error
      if (context?.previousConversations) {
        queryClient.setQueryData(['conversations'], context.previousConversations)
      }
    },
    onSettled: () => {
      // Refetch after error or success
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
    },
  })
}

/**
 * Hook to rename a conversation
 */
export function useRenameConversation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ conversationId, title }: { conversationId: string; title: string }) => {
      const response = await fetch(`/api/conversations/${conversationId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ title }),
      })
      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new Error(error?.error?.message || 'Failed to rename conversation')
      }
      return response.json()
    },
    onMutate: async ({ conversationId, title }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['conversations'] })

      // Snapshot the previous value
      const previousConversations = queryClient.getQueryData<Conversation[]>(['conversations'])

      // Optimistically update
      queryClient.setQueryData<Conversation[]>(['conversations'], (old) =>
        old?.map((c) => (c.id === conversationId ? { ...c, title } : c))
      )

      return { previousConversations }
    },
    onError: (_err, _variables, context) => {
      // Rollback on error
      if (context?.previousConversations) {
        queryClient.setQueryData(['conversations'], context.previousConversations)
      }
    },
    onSettled: () => {
      // Refetch after error or success
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
    },
  })
}
