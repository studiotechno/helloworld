'use client'

import { ExternalLink, FileCode } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getExtensionColor, extractExtension } from '@/lib/utils/file-extensions'
import { useCitationContext } from './CitationContext'

export interface CodeCitationProps {
  path: string
  line?: number
  endLine?: number
  variant?: 'inline' | 'block'
  className?: string
}

/**
 * Get a short display name for the file path
 * Shows only filename for short paths, or last 2 segments for longer paths
 */
function getDisplayPath(path: string): string {
  const segments = path.split('/')
  if (segments.length <= 2) {
    return path
  }
  // Show last 2 segments with ellipsis
  return `.../${segments.slice(-2).join('/')}`
}

/**
 * Format line range for display
 */
function formatLineRange(line?: number, endLine?: number): string {
  if (line === undefined) return ''
  if (endLine !== undefined && endLine !== line) {
    return `:${line}-${endLine}`
  }
  return `:${line}`
}

/**
 * Build GitHub URL with line highlighting
 * GitHub supports #L5 for single line or #L5-L10 for range
 */
function buildGitHubLineHash(line?: number, endLine?: number): string {
  if (line === undefined) return ''
  if (endLine !== undefined && endLine !== line) {
    return `#L${line}-L${endLine}`
  }
  return `#L${line}`
}

export function CodeCitation({
  path,
  line,
  endLine,
  variant = 'inline',
  className,
}: CodeCitationProps) {
  const { githubBaseUrl } = useCitationContext()
  const extension = extractExtension(path)
  const extensionColor = getExtensionColor(extension)
  const lineDisplay = formatLineRange(line, endLine)

  // Check if path contains parentheses (Next.js route groups)
  // These don't exist in GitHub, so we show full path without link
  const hasRouteGroup = path.includes('(') || path.includes(')')
  const displayPath = hasRouteGroup ? path : getDisplayPath(path)

  // Build GitHub URL only if no route groups (parentheses break GitHub URLs)
  const githubUrl = githubBaseUrl && !hasRouteGroup
    ? `${githubBaseUrl}/${path}${buildGitHubLineHash(line, endLine)}`
    : null

  const content = (
    <>
      <FileCode
        className={cn(
          variant === 'inline' ? 'size-3' : 'size-3.5',
          'shrink-0'
        )}
        aria-hidden="true"
      />
      <span className={cn('truncate', hasRouteGroup ? 'max-w-none' : 'max-w-[180px]')} title={path}>
        {displayPath}
      </span>
      {lineDisplay && (
        <span className="opacity-70">{lineDisplay}</span>
      )}
      {extension && (
        <span
          className={cn(
            'rounded px-1 py-0.5 text-[10px] font-medium uppercase leading-none',
            extensionColor
          )}
        >
          {extension}
        </span>
      )}
      {githubUrl && (
        <ExternalLink className="size-3 opacity-50 group-hover:opacity-100" />
      )}
    </>
  )

  const sharedClasses = cn(
    'group inline-flex items-center gap-1.5',
    variant === 'inline' ? 'px-2 py-1' : 'px-2.5 py-1.5',
    'rounded-md border',
    'bg-muted/50 border-border/50',
    variant === 'inline' ? 'text-xs' : 'text-sm',
    'font-mono transition-all duration-200',
    'text-muted-foreground',
    className
  )

  // If we have a GitHub URL, render as a link
  if (githubUrl) {
    return (
      <a
        href={githubUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          sharedClasses,
          'hover:bg-muted hover:border-primary/30 hover:text-foreground',
          'hover:shadow-sm'
        )}
        title={`Ouvrir ${path} sur GitHub`}
      >
        {content}
      </a>
    )
  }

  // Fallback to non-interactive span if no GitHub URL
  return (
    <span className={sharedClasses} title={path}>
      {content}
    </span>
  )
}
