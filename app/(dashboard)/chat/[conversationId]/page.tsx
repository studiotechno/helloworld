'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useCallback, useState, useRef, useMemo } from 'react'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import { useActiveRepo, useAnalysisLoader } from '@/hooks'
import {
  ChatContainer,
  ChatInput,
  ChatMessage,
  CitationProvider,
  TypingIndicator,
  AnalysisLoader,
  ScrollToBottom,
} from '@/components/chat'
import { toast } from 'sonner'

interface ConversationPageProps {
  params: Promise<{
    conversationId: string
  }>
}

interface StoredMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
}

interface ConversationData {
  conversation: {
    id: string
    title: string | null
    repository_id: string
  }
  messages: StoredMessage[]
}

// Helper to extract text content from a chat message (supports both content string and parts array)
function extractMessageContent(message: { content?: string; parts?: Array<{ type: string; text?: string }> }): string {
  if (message.content && typeof message.content === 'string') {
    return message.content
  }
  if (message.parts) {
    return message.parts
      .filter((part): part is { type: 'text'; text: string } => part.type === 'text' && typeof part.text === 'string')
      .map((part) => part.text)
      .join('')
  }
  return ''
}

export default function ConversationPage({ params }: ConversationPageProps) {
  const router = useRouter()
  const { data: activeRepo, isLoading: repoLoading } = useActiveRepo()
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const [userScrolled, setUserScrolled] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [storedMessages, setStoredMessages] = useState<StoredMessage[]>([])
  const [isLoadingMessages, setIsLoadingMessages] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  // Unwrap params
  useEffect(() => {
    params.then((p) => setConversationId(p.conversationId))
  }, [params])

  // Load existing messages
  useEffect(() => {
    if (!conversationId) return

    const loadMessages = async () => {
      setIsLoadingMessages(true)
      setLoadError(null)

      try {
        const response = await fetch(`/api/conversations/${conversationId}/messages`)
        if (!response.ok) {
          if (response.status === 404) {
            setLoadError('Conversation non trouvee')
            return
          }
          throw new Error('Failed to load messages')
        }

        const data: ConversationData = await response.json()
        setStoredMessages(data.messages)
      } catch (err) {
        console.error('[Chat] Failed to load messages:', err)
        setLoadError('Erreur lors du chargement des messages')
      } finally {
        setIsLoadingMessages(false)
      }
    }

    loadMessages()
  }, [conversationId])

  // Create chat transport with conversationId
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: '/api/chat',
        body: {
          repoId: activeRepo?.id,
          conversationId,
        },
      }),
    [activeRepo?.id, conversationId]
  )

  // Convert stored messages to the format expected by useChat
  const initialMessages = useMemo(() => {
    return storedMessages.map((msg) => ({
      id: msg.id,
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
      parts: [{ type: 'text' as const, text: msg.content }],
    }))
  }, [storedMessages])

  // Track the previous status for detecting when streaming completes
  const previousStatusRef = useRef<string>('')

  // useChat hook - use conversationId as id to force reinitialize when conversation changes
  const { messages: chatMessages, sendMessage, status, error } = useChat({
    id: conversationId || undefined, // Forces hook to reinitialize when conversationId changes
    transport,
    onError: (err) => {
      console.error('[Chat] Error:', err)
      toast.error('Une erreur est survenue. Veuillez reessayer.')
    },
  })

  const isLoading = status === 'submitted' || status === 'streaming'

  // Analysis loader state management
  const analysisLoader = useAnalysisLoader(status === 'submitted')

  // Reload messages from DB after streaming completes
  useEffect(() => {
    const prevStatus = previousStatusRef.current

    // After streaming completes, reload messages from database
    if (prevStatus === 'streaming' && status === 'ready' && conversationId) {
      const reloadMessages = async () => {
        try {
          const response = await fetch(`/api/conversations/${conversationId}/messages`)
          if (response.ok) {
            const data: ConversationData = await response.json()
            setStoredMessages(data.messages)
          }
        } catch (err) {
          // Silently fail - messages will be loaded on next interaction
        }
      }
      reloadMessages()
    }

    previousStatusRef.current = status
  }, [status, conversationId])

  // Messages to display:
  // - Show stored messages from DB as the base
  // - When streaming, append new messages from chatMessages (optimistic UI)
  // - Deduplicate by ID to prevent duplicates after DB reload
  const allMessages = useMemo(() => {
    if (chatMessages.length === 0) {
      return initialMessages
    }

    // Create a Set of stored message IDs for deduplication
    const storedIds = new Set(initialMessages.map((m) => m.id))

    // Filter out chatMessages that are already in stored messages
    const newChatMessages = chatMessages
      .filter((m) => !storedIds.has(m.id))
      .map((m) => ({
        id: m.id,
        role: m.role as 'user' | 'assistant',
        content: extractMessageContent(m),
        parts: m.parts,
      }))

    return [...initialMessages, ...newChatMessages]
  }, [chatMessages, initialMessages])

  // Redirect to repos if no active repo
  useEffect(() => {
    if (!repoLoading && !activeRepo) {
      router.push('/repos')
    }
  }, [activeRepo, repoLoading, router])

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (!userScrolled && scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight
    }
  }, [allMessages, isLoading, userScrolled])

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
  if (repoLoading || !conversationId || isLoadingMessages) {
    return (
      <ChatContainer>
        <div className="flex flex-1 items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="size-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <p className="text-sm text-muted-foreground">
              Chargement de la conversation...
            </p>
          </div>
        </div>
      </ChatContainer>
    )
  }

  // Error state
  if (loadError) {
    return (
      <ChatContainer>
        <div className="flex flex-1 items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <p className="text-destructive">{loadError}</p>
            <button
              onClick={() => router.push('/chat')}
              className="text-sm text-muted-foreground underline hover:text-foreground"
            >
              Retour au chat
            </button>
          </div>
        </div>
      </ChatContainer>
    )
  }

  // No repo connected
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

  const hasMessages = allMessages.length > 0

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
              {allMessages.map((message) => (
                <ChatMessage
                  key={message.id}
                  role={message.role as 'user' | 'assistant'}
                  content={extractMessageContent(message)}
                  isStreaming={
                    status === 'streaming' &&
                    message.role === 'assistant' &&
                    message.id === allMessages[allMessages.length - 1]?.id
                  }
                />
              ))}
              {status === 'submitted' && allMessages[allMessages.length - 1]?.role === 'user' && (
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
            <div className="flex flex-1 items-center justify-center py-8">
              <p className="text-muted-foreground">Aucun message dans cette conversation</p>
            </div>
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
