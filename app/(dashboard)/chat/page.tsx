'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import { useQueryClient } from '@tanstack/react-query'
import { useActiveRepo, useAnalysisLoader } from '@/hooks'
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
  const queryClient = useQueryClient()
  const { data: activeRepo, isLoading: repoLoading } = useActiveRepo()
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const [userScrolled, setUserScrolled] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const [conversationId, setConversationId] = useState<string | null>(null)
  const previousStatusRef = useRef<string>('')

  // Create chat transport with our API endpoint
  // Include conversationId once we have it (after first message)
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: '/api/chat',
        body: { repoId: activeRepo?.id, conversationId },
      }),
    [activeRepo?.id, conversationId]
  )

  // useChat hook from Vercel AI SDK v6
  // Use conversationId as id so hook reinitializes when we get the conversation ID
  const { messages, sendMessage, status, error } = useChat({
    id: conversationId || 'new-chat',
    transport,
    onError: (err) => {
      console.error('[Chat] Error:', err)
      toast.error('Une erreur est survenue. Veuillez reessayer.')
    },
  })

  const isLoading = status === 'submitted' || status === 'streaming'

  // Analysis loader state management
  const analysisLoader = useAnalysisLoader(status === 'submitted')

  // Redirect to repos if no active repo
  useEffect(() => {
    if (!repoLoading && !activeRepo) {
      router.push('/repos')
    }
  }, [activeRepo, repoLoading, router])

  // Handle status changes: invalidate cache on submit, capture conversationId on completion
  useEffect(() => {
    const prevStatus = previousStatusRef.current

    // When message is submitted, invalidate conversations cache so sidebar updates immediately
    if (prevStatus === 'ready' && status === 'submitted' && messages.length > 0) {
      // Small delay to let the API create the conversation
      const timer = setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['conversations'] })
      }, 500)
      previousStatusRef.current = status
      return () => clearTimeout(timer)
    }

    // After streaming completes, capture the conversation ID and update URL
    if (prevStatus === 'streaming' && status === 'ready' && messages.length > 0 && !conversationId) {
      const captureConversationId = async () => {
        try {
          const response = await fetch('/api/conversations')
          if (response.ok) {
            const conversations = await response.json()
            if (conversations.length > 0) {
              const latestConversation = conversations[0]
              // Store the conversation ID for subsequent messages
              setConversationId(latestConversation.id)
              // Update URL without full page reload (keeps chat state)
              router.replace(`/chat/${latestConversation.id}`, { scroll: false })
            }
          }
        } catch (err) {
          console.error('[Chat] Failed to fetch conversation:', err)
        }
      }
      captureConversationId()
    }

    previousStatusRef.current = status
  }, [status, messages.length, conversationId, router, queryClient])

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

  // Loading state
  if (repoLoading) {
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

  // No repo connected - will redirect
  if (!activeRepo) {
    return (
      <ChatContainer>
        <div className="flex flex-1 items-center justify-center">
          <p className="text-muted-foreground">
            Redirection vers la selection de repository...
          </p>
        </div>
      </ChatContainer>
    )
  }

  const hasMessages = messages.length > 0

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
          {hasMessages ? (
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
            <EmptyState onSuggestionClick={handleSuggestionClick} />
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
        <div className="mx-auto mb-2 max-w-[800px] rounded-lg bg-destructive/10 px-4 py-2 text-center text-sm text-destructive">
          {error.message || 'Une erreur est survenue'}
        </div>
      )}

      {/* Input area */}
      <ChatInput
        value={inputValue}
        onChange={handleInputChange}
        onSend={handleSend}
        disabled={isLoading}
      />
    </ChatContainer>
  )
}
