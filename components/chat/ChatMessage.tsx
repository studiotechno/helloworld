'use client'

import { useState, ComponentPropsWithoutRef } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { Copy, Check, User, Sparkles, FileCode, Terminal } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { CodeCitation } from './CodeCitation'
import { parseCitations } from '@/lib/utils/citation-parser'

export interface ChatMessageProps {
  role: 'user' | 'assistant'
  content: string
  isStreaming?: boolean
}

/**
 * Copy button component for code blocks
 */
function CopyButton({ text, className }: { text: string; className?: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleCopy}
      className={cn(
        'h-7 gap-1.5 px-2 text-xs opacity-0 transition-opacity group-hover/code:opacity-100',
        'text-muted-foreground hover:text-foreground',
        className
      )}
    >
      {copied ? (
        <>
          <Check className="size-3.5 text-green-500" />
          <span>Copié</span>
        </>
      ) : (
        <>
          <Copy className="size-3.5" />
          <span>Copier</span>
        </>
      )}
    </Button>
  )
}

/**
 * Code block component with syntax highlighting
 */
function CodeBlock({
  children,
  className,
  ...props
}: ComponentPropsWithoutRef<'code'>) {
  const match = /language-(\w+)/.exec(className || '')
  const language = match ? match[1] : ''
  const codeString = String(children).replace(/\n$/, '')

  // Inline code
  if (!match) {
    return (
      <code
        className={cn(
          'rounded-md bg-muted/80 px-1.5 py-0.5 font-mono text-sm',
          'text-primary dark:text-primary-foreground',
          className
        )}
        {...props}
      >
        {children}
      </code>
    )
  }

  // Get language display name
  const languageLabels: Record<string, string> = {
    js: 'JavaScript',
    javascript: 'JavaScript',
    ts: 'TypeScript',
    typescript: 'TypeScript',
    tsx: 'TypeScript (React)',
    jsx: 'JavaScript (React)',
    py: 'Python',
    python: 'Python',
    bash: 'Bash',
    sh: 'Shell',
    shell: 'Shell',
    json: 'JSON',
    sql: 'SQL',
    css: 'CSS',
    html: 'HTML',
    yaml: 'YAML',
    yml: 'YAML',
    md: 'Markdown',
    markdown: 'Markdown',
    go: 'Go',
    rust: 'Rust',
    java: 'Java',
    cpp: 'C++',
    c: 'C',
  }

  const displayLanguage = languageLabels[language] || language.toUpperCase()
  const isTerminal = ['bash', 'sh', 'shell', 'zsh'].includes(language)

  return (
    <div className="group/code relative my-4 overflow-hidden rounded-lg border border-border/50 bg-[#282c34]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/30 bg-muted/30 px-4 py-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {isTerminal ? (
            <Terminal className="size-3.5" />
          ) : (
            <FileCode className="size-3.5" />
          )}
          <span>{displayLanguage}</span>
        </div>
        <CopyButton text={codeString} />
      </div>
      {/* Code content */}
      <SyntaxHighlighter
        style={oneDark}
        language={language}
        PreTag="div"
        customStyle={{
          margin: 0,
          padding: '1rem',
          background: 'transparent',
          fontSize: '0.875rem',
        }}
        codeTagProps={{
          style: {
            fontFamily: 'var(--font-mono), ui-monospace, monospace',
          },
        }}
      >
        {codeString}
      </SyntaxHighlighter>
    </div>
  )
}

/**
 * Custom markdown components for better styling
 */
const markdownComponents = {
  // Headings with better visual hierarchy
  h1: ({ children, ...props }: ComponentPropsWithoutRef<'h1'>) => (
    <h1
      className="mb-4 mt-6 border-b border-border/50 pb-2 text-2xl font-bold first:mt-0"
      {...props}
    >
      {children}
    </h1>
  ),
  h2: ({ children, ...props }: ComponentPropsWithoutRef<'h2'>) => (
    <h2
      className="mb-3 mt-6 text-xl font-semibold text-foreground first:mt-0"
      {...props}
    >
      {children}
    </h2>
  ),
  h3: ({ children, ...props }: ComponentPropsWithoutRef<'h3'>) => (
    <h3
      className="mb-2 mt-5 text-lg font-semibold text-foreground first:mt-0"
      {...props}
    >
      {children}
    </h3>
  ),
  h4: ({ children, ...props }: ComponentPropsWithoutRef<'h4'>) => (
    <h4
      className="mb-2 mt-4 text-base font-semibold text-foreground first:mt-0"
      {...props}
    >
      {children}
    </h4>
  ),

  // Paragraphs with better spacing
  p: ({ children, ...props }: ComponentPropsWithoutRef<'p'>) => (
    <p className="mb-3 leading-7 last:mb-0 [&:not(:first-child)]:mt-3" {...props}>
      {children}
    </p>
  ),

  // Lists with better styling
  ul: ({ children, ...props }: ComponentPropsWithoutRef<'ul'>) => (
    <ul className="my-4 ml-6 list-disc space-y-2 [&>li]:pl-1" {...props}>
      {children}
    </ul>
  ),
  ol: ({ children, ...props }: ComponentPropsWithoutRef<'ol'>) => (
    <ol className="my-4 ml-6 list-decimal space-y-2 [&>li]:pl-1" {...props}>
      {children}
    </ol>
  ),
  li: ({ children, ...props }: ComponentPropsWithoutRef<'li'>) => (
    <li className="leading-7" {...props}>
      {children}
    </li>
  ),

  // Blockquotes
  blockquote: ({ children, ...props }: ComponentPropsWithoutRef<'blockquote'>) => (
    <blockquote
      className="my-4 border-l-4 border-primary/50 bg-muted/30 py-2 pl-4 pr-2 italic"
      {...props}
    >
      {children}
    </blockquote>
  ),

  // Tables
  table: ({ children, ...props }: ComponentPropsWithoutRef<'table'>) => (
    <div className="my-4 overflow-x-auto rounded-lg border border-border/50">
      <table className="w-full border-collapse text-sm" {...props}>
        {children}
      </table>
    </div>
  ),
  thead: ({ children, ...props }: ComponentPropsWithoutRef<'thead'>) => (
    <thead className="bg-muted/50" {...props}>
      {children}
    </thead>
  ),
  th: ({ children, ...props }: ComponentPropsWithoutRef<'th'>) => (
    <th
      className="border-b border-border/50 px-4 py-2 text-left font-semibold"
      {...props}
    >
      {children}
    </th>
  ),
  td: ({ children, ...props }: ComponentPropsWithoutRef<'td'>) => (
    <td className="border-b border-border/30 px-4 py-2" {...props}>
      {children}
    </td>
  ),

  // Horizontal rule
  hr: ({ ...props }: ComponentPropsWithoutRef<'hr'>) => (
    <hr className="my-6 border-border/50" {...props} />
  ),

  // Links
  a: ({ children, href, ...props }: ComponentPropsWithoutRef<'a'>) => (
    <a
      href={href}
      className="text-primary underline decoration-primary/50 underline-offset-2 hover:decoration-primary"
      target="_blank"
      rel="noopener noreferrer"
      {...props}
    >
      {children}
    </a>
  ),

  // Strong/Bold
  strong: ({ children, ...props }: ComponentPropsWithoutRef<'strong'>) => (
    <strong className="font-semibold text-foreground" {...props}>
      {children}
    </strong>
  ),

  // Code blocks and inline code
  code: CodeBlock,

  // Pre tag (wrapper for code) - just pass through children
  pre: ({ children }: ComponentPropsWithoutRef<'pre'>) => (
    <>{children}</>
  ),
}

/**
 * Renders text with inline citations
 * Used within markdown text nodes to preserve structure
 */
function TextWithCitations({ children }: { children: string }) {
  const citations = parseCitations(children)

  if (citations.length === 0) {
    return <>{children}</>
  }

  const result: React.ReactNode[] = []
  let lastIndex = 0

  citations.forEach((citation, idx) => {
    // Add text before citation
    if (citation.startIndex > lastIndex) {
      result.push(children.slice(lastIndex, citation.startIndex))
    }
    // Add citation component
    result.push(
      <CodeCitation
        key={`citation-${idx}`}
        path={citation.path}
        line={citation.line}
        endLine={citation.endLine}
        variant="inline"
      />
    )
    lastIndex = citation.endIndex
  })

  // Add remaining text
  if (lastIndex < children.length) {
    result.push(children.slice(lastIndex))
  }

  return <>{result}</>
}

/**
 * Recursively process children to handle citations in text nodes
 */
function processChildren(children: React.ReactNode): React.ReactNode {
  if (typeof children === 'string') {
    return <TextWithCitations>{children}</TextWithCitations>
  }
  if (Array.isArray(children)) {
    return children.map((child, idx) => {
      if (typeof child === 'string') {
        return <TextWithCitations key={idx}>{child}</TextWithCitations>
      }
      return child
    })
  }
  return children
}

/**
 * Renders content with markdown and inline citations
 * Citations are processed within text nodes to preserve markdown structure
 */
function ContentWithCitations({ content }: { content: string }) {
  // Create components that process citations within text
  const componentsWithCitations = {
    ...markdownComponents,
    // Override p to process citations
    p: ({ children, ...props }: ComponentPropsWithoutRef<'p'>) => (
      <p className="mb-3 leading-7 last:mb-0 [&:not(:first-child)]:mt-3" {...props}>
        {processChildren(children)}
      </p>
    ),
    // Override li to process citations
    li: ({ children, ...props }: ComponentPropsWithoutRef<'li'>) => (
      <li className="leading-7" {...props}>
        {processChildren(children)}
      </li>
    ),
    // Override td to process citations
    td: ({ children, ...props }: ComponentPropsWithoutRef<'td'>) => (
      <td className="border-b border-border/30 px-4 py-2" {...props}>
        {processChildren(children)}
      </td>
    ),
    // Override blockquote to process citations
    blockquote: ({ children, ...props }: ComponentPropsWithoutRef<'blockquote'>) => (
      <blockquote
        className="my-4 border-l-4 border-primary/50 bg-muted/30 py-2 pl-4 pr-2 italic"
        {...props}
      >
        {processChildren(children)}
      </blockquote>
    ),
  }

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={componentsWithCitations}
    >
      {content || ' '}
    </ReactMarkdown>
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
            'max-w-none text-sm',
            isUser
              ? '[&_*]:text-primary-foreground'
              : '',
            isStreaming && 'after:ml-1 after:inline-block after:h-4 after:w-1 after:animate-pulse after:bg-current after:content-[""]'
          )}
        >
          <ContentWithCitations content={content || ' '} />
        </div>
      </div>
    </div>
  )
}
