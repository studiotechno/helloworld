'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import { useQueryClient } from '@tanstack/react-query'
import { useActiveRepo, useAnalysisLoader, useIndexingStatus } from '@/hooks'
import {
  ChatContainer,
  ChatInput,
  ChatMessage,
  CitationProvider,
  EmptyState,
  TypingIndicator,
  AnalysisLoader,
  ScrollToBottom,
} from '@/components/chat'
import { toast } from 'sonner'

export default function ChatPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()
  const { data: activeRepo, isLoading: repoLoading } = useActiveRepo()
  const { isIndexed, isInProgress, isLoading: indexLoading, startIndexing, isStarting } = useIndexingStatus(activeRepo?.id)
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const [userScrolled, setUserScrolled] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const newChatParam = searchParams.get('new')

  // Conversation ID is stored in a ref to avoid re-renders during streaming
  // We only use state for the initial null value to trigger effects when needed
  const conversationIdRef = useRef<string | null>(null)
  const previousRepoIdRef = useRef<string | undefined>(undefined)

  // Reset chat when repo changes
  useEffect(() => {
    if (activeRepo?.id && previousRepoIdRef.current && activeRepo.id !== previousRepoIdRef.current) {
      // Repo changed - reset conversation
      conversationIdRef.current = null
      setInputValue('')
    }
    previousRepoIdRef.current = activeRepo?.id
  }, [activeRepo?.id])

  // Refs for values needed in the fetch callback
  const queryClientRef = useRef(queryClient)
  const activeRepoIdRef = useRef(activeRepo?.id)

  useEffect(() => {
    queryClientRef.current = queryClient
  }, [queryClient])

  useEffect(() => {
    activeRepoIdRef.current = activeRepo?.id
  }, [activeRepo?.id])

  // Create chat transport with our API endpoint
  // The transport is stable - it doesn't depend on conversationId state
  // Instead, it reads conversationId from a ref in the fetch body
  /* eslint-disable react-hooks/refs */
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: '/api/chat',
        // Note: body is set dynamically via prepareRequestBody below
        fetch: async (url: RequestInfo | URL, options?: RequestInit): Promise<Response> => {
          // Inject conversationId into the request body
          if (options?.body) {
            try {
              const body = JSON.parse(options.body as string)
              body.repoId = activeRepoIdRef.current
              body.conversationId = conversationIdRef.current
              options = { ...options, body: JSON.stringify(body) }
            } catch {
              // If parsing fails, continue with original body
            }
          }

          const response = await fetch(url, options)

          // Capture conversation ID from headers on first response (for new conversations)
          const newConversationId = response.headers.get('X-Conversation-Id')
          if (newConversationId && !conversationIdRef.current) {
            conversationIdRef.current = newConversationId

            // Invalidate conversations cache immediately so sidebar updates
            queryClientRef.current.invalidateQueries({ queryKey: ['conversations', activeRepoIdRef.current] })

            // Update URL without causing a page remount
            window.history.replaceState(null, '', `/chat/${newConversationId}`)
          }

          return response
        },
      }),
    [] // No dependencies - transport is stable
  )
  /* eslint-enable react-hooks/refs */

  // useChat hook from Vercel AI SDK v6
  // Use a stable chat ID based on repo only - conversation tracking is internal
  const chatId = `chat-${activeRepo?.id || 'none'}`
  const { messages, sendMessage, status, error, setMessages } = useChat({
    id: chatId,
    transport,
    onError: (err) => {
      console.error('[Chat] Error:', err)
      toast.error('Une erreur est survenue. Veuillez reessayer.')
    },
  })

  // Handle new chat request from sidebar
  useEffect(() => {
    if (newChatParam) {
      // Reset conversation state for new chat
      conversationIdRef.current = null
      setMessages([])
      setInputValue('')
      // Clear the URL param
      window.history.replaceState(null, '', '/chat')
    }
  }, [newChatParam, setMessages])

  const isLoading = status === 'submitted' || status === 'streaming'

  // Analysis loader state management
  const analysisLoader = useAnalysisLoader(status === 'submitted')

  // Auto-scroll to bottom when new messages arrive (unless user scrolled up)
  useEffect(() => {
    if (!userScrolled && scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight
    }
  }, [messages, isLoading, userScrolled])

  // Track if user has scrolled up
  const handleScroll = useCallback(() => {
    if (scrollAreaRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = scrollAreaRef.current
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 100
      setUserScrolled(!isAtBottom)
    }
  }, [])

  // Scroll to bottom function
  const scrollToBottom = useCallback(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTo({
        top: scrollAreaRef.current.scrollHeight,
        behavior: 'smooth',
      })
      setUserScrolled(false)
    }
  }, [])

  // Handle suggestion click
  const handleSuggestionClick = useCallback((suggestion: string) => {
    setInputValue(suggestion)
  }, [])

  // Handle send
  const handleSend = useCallback(
    async (message: string) => {
      setInputValue('')
      await sendMessage({ text: message })
    },
    [sendMessage]
  )

  // Handle input change
  const handleInputChange = useCallback((value: string) => {
    setInputValue(value)
  }, [])

  // Handle index repo - start indexing and redirect to repos page
  const handleIndexRepo = useCallback(() => {
    startIndexing()
    toast.success('Indexation lancee')
    router.push('/repos')
  }, [startIndexing, router])

  // Determine empty state mode
  const getEmptyStateMode = (): 'no-repo' | 'not-indexed' | 'indexing' | 'ready' => {
    if (!activeRepo) return 'no-repo'
    if (isInProgress) return 'indexing'
    if (!isIndexed) return 'not-indexed'
    return 'ready'
  }

  // Loading state
  if (repoLoading || indexLoading) {
    return (
      <ChatContainer>
        <div className="flex flex-1 items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="size-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <p className="text-sm text-muted-foreground">Chargement...</p>
          </div>
        </div>
      </ChatContainer>
    )
  }

  const emptyStateMode = getEmptyStateMode()
  const hasMessages = messages.length > 0
  const canChat = emptyStateMode === 'ready'

  // Helper function to extract text content from message parts
  const getMessageContent = (message: (typeof messages)[number]): string => {
    if (!message.parts) return ''
    return message.parts
      .filter((part): part is { type: 'text'; text: string } => part.type === 'text')
      .map((part) => part.text)
      .join('')
  }

  return (
    <ChatContainer className="relative pb-0">
      {/* Messages area */}
      <div
        ref={scrollAreaRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto"
      >
        <CitationProvider
          repoFullName={activeRepo?.full_name}
          defaultBranch={activeRepo?.default_branch}
        >
          {hasMessages && canChat ? (
            <div className="space-y-2 py-4">
              {messages.map((message) => (
                <ChatMessage
                  key={message.id}
                  role={message.role as 'user' | 'assistant'}
                  content={getMessageContent(message)}
                  isStreaming={
                    status === 'streaming' &&
                    message.role === 'assistant' &&
                    message.id === messages[messages.length - 1]?.id
                  }
                />
              ))}
              {status === 'submitted' && messages[messages.length - 1]?.role === 'user' && (
                analysisLoader.showLoader ? (
                  <AnalysisLoader
                    phase={analysisLoader.phase as 'loading' | 'scanning' | 'processing' | 'timeout'}
                    message={analysisLoader.message}
                    filesAnalyzed={analysisLoader.filesAnalyzed}
                    foldersAnalyzed={analysisLoader.foldersAnalyzed}
                    onCancel={analysisLoader.phase === 'timeout' ? analysisLoader.reset : undefined}
                  />
                ) : (
                  <TypingIndicator />
                )
              )}
            </div>
          ) : (
            <EmptyState
              mode={emptyStateMode}
              repoName={activeRepo?.full_name}
              onSuggestionClick={handleSuggestionClick}
              onIndexRepo={handleIndexRepo}
            />
          )}
        </CitationProvider>
      </div>

      {/* Scroll to bottom button */}
      <ScrollToBottom
        onClick={scrollToBottom}
        visible={userScrolled && hasMessages}
      />

      {/* Error display */}
      {error && (
        <div className="mx-auto mb-2 max-w-[1000px] rounded-lg bg-destructive/10 px-4 py-2 text-center text-sm text-destructive">
          {error.message || 'Une erreur est survenue'}
        </div>
      )}

      {/* Input area - only show when ready to chat */}
      {canChat && (
        <ChatInput
          value={inputValue}
          onChange={handleInputChange}
          onSend={handleSend}
          disabled={isLoading}
        />
      )}
    </ChatContainer>
  )
}
