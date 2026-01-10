'use client'

import { useState, useMemo, Fragment } from 'react'
import ReactMarkdown from 'react-markdown'
import { Copy, Check, User, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { CodeCitation } from './CodeCitation'
import {
  splitContentByCitations,
  isCitation,
} from '@/lib/utils/citation-parser'

export interface ChatMessageProps {
  role: 'user' | 'assistant'
  content: string
  isStreaming?: boolean
}

/**
 * Renders content with inline code citations
 * Parses [file.ts:line] patterns and replaces them with CodeCitation components
 */
function ContentWithCitations({ content }: { content: string }) {
  const segments = useMemo(() => splitContentByCitations(content), [content])

  // If no citations, render as plain markdown
  if (segments.length === 1 && typeof segments[0] === 'string') {
    return <ReactMarkdown>{content || ' '}</ReactMarkdown>
  }

  // Render segments with citations inline
  return (
    <>
      {segments.map((segment, index) => {
        if (isCitation(segment)) {
          return (
            <CodeCitation
              key={`citation-${index}`}
              path={segment.path}
              line={segment.line}
              variant="inline"
            />
          )
        }
        // Render text segments as markdown
        return (
          <Fragment key={`text-${index}`}>
            <ReactMarkdown>{segment || ''}</ReactMarkdown>
          </Fragment>
        )
      })}
    </>
  )
}

export function ChatMessage({ role, content, isStreaming = false }: ChatMessageProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const isUser = role === 'user'

  return (
    <div
      className={cn(
        'group flex gap-3 px-4 py-4',
        isUser ? 'flex-row-reverse' : 'flex-row'
      )}
      role="article"
      aria-label={isUser ? 'Votre message' : 'Reponse de l\'assistant'}
    >
      {/* Avatar */}
      <div
        className={cn(
          'flex size-8 shrink-0 items-center justify-center rounded-full',
          isUser
            ? 'bg-primary text-primary-foreground'
            : 'bg-secondary text-secondary-foreground'
        )}
      >
        {isUser ? (
          <User className="size-4" />
        ) : (
          <Sparkles className="size-4" />
        )}
      </div>

      {/* Message Content */}
      <div
        className={cn(
          'relative max-w-[85%] rounded-2xl px-4 py-3',
          isUser
            ? 'rounded-br-sm bg-primary text-primary-foreground shadow-lg shadow-primary/25'
            : 'rounded-bl-sm bg-secondary/50 text-foreground'
        )}
      >
        {/* Copy button - appears on hover */}
        <Button
          variant="ghost"
          size="icon"
          onClick={handleCopy}
          className={cn(
            'absolute -top-2 opacity-0 transition-opacity group-hover:opacity-100',
            'size-7 rounded-full bg-background/80 backdrop-blur-sm',
            'hover:bg-background',
            isUser ? '-left-2' : '-right-2'
          )}
          aria-label={copied ? 'Copie' : 'Copier le message'}
        >
          {copied ? (
            <Check className="size-3.5 text-green-500" />
          ) : (
            <Copy className="size-3.5" />
          )}
        </Button>

        {/* Message text with markdown and citation support */}
        <div
          className={cn(
            'prose prose-sm max-w-none',
            isUser
              ? 'prose-invert'
              : 'prose-neutral dark:prose-invert',
            'prose-p:my-1 prose-p:leading-relaxed',
            'prose-pre:bg-background/50 prose-pre:text-foreground',
            'prose-code:rounded prose-code:bg-background/30 prose-code:px-1 prose-code:py-0.5',
            'prose-code:before:content-none prose-code:after:content-none',
            isStreaming && 'after:inline-block after:w-1 after:animate-pulse after:bg-current after:content-[""]'
          )}
        >
          <ContentWithCitations content={content || ' '} />
        </div>
      </div>
    </div>
  )
}
