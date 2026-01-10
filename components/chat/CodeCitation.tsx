'use client'

import { useState } from 'react'
import { File } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { getExtensionColor, extractExtension } from '@/lib/utils/file-extensions'

export interface CodeCitationProps {
  path: string
  line?: number
  variant?: 'inline' | 'block'
  className?: string
}

export function CodeCitation({
  path,
  line,
  variant = 'inline',
  className,
}: CodeCitationProps) {
  const [copied, setCopied] = useState(false)
  const extension = extractExtension(path)
  const extensionColor = getExtensionColor(extension)

  const handleCopy = async () => {
    const textToCopy = line ? `${path}:${line}` : path
    try {
      await navigator.clipboard.writeText(textToCopy)
      setCopied(true)
      toast.success('Copie !')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Erreur lors de la copie')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleCopy()
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      onKeyDown={handleKeyDown}
      className={cn(
        'inline-flex items-center gap-1.5',
        variant === 'inline' ? 'px-1.5 py-0.5' : 'px-2.5 py-1',
        'rounded-full border border-primary/30 bg-primary/10',
        variant === 'inline' ? 'text-xs' : 'text-sm',
        'font-mono transition-all duration-200',
        'hover:scale-[1.02] hover:shadow-[0_0_12px_rgba(236,72,153,0.3)]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
        copied && 'bg-green-500/20 border-green-500/30',
        className
      )}
      role="button"
      aria-label={`Copier la citation: ${path}${line ? ` ligne ${line}` : ''}`}
    >
      <File
        className={cn(
          variant === 'inline' ? 'size-3' : 'size-3.5',
          'shrink-0 text-muted-foreground'
        )}
        aria-hidden="true"
      />
      <span className="text-foreground truncate max-w-[200px]">{path}</span>
      {line !== undefined && (
        <span className="text-muted-foreground">:{line}</span>
      )}
      {extension && (
        <span
          className={cn(
            'rounded px-1 text-[10px] font-medium uppercase',
            extensionColor
          )}
        >
          {extension}
        </span>
      )}
    </button>
  )
}
