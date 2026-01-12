'use client'

import { useRef, useCallback, KeyboardEvent, ChangeEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Send } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ChatInputProps {
  value: string
  onChange: (value: string) => void
  onSend: (message: string) => void
  disabled?: boolean
  placeholder?: string
}

export function ChatInput({
  value,
  onChange,
  onSend,
  disabled = false,
  placeholder = 'Posez une question sur votre code...',
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleSubmit = useCallback(() => {
    const trimmed = value.trim()
    if (trimmed && !disabled) {
      onSend(trimmed)
      onChange('')
      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto'
      }
    }
  }, [value, disabled, onSend, onChange])

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      handleSubmit()
    }
  }

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value)
    // Auto-resize
    const textarea = e.target
    textarea.style.height = 'auto'
    textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`
  }

  const canSend = value.trim().length > 0 && !disabled

  return (
    <div className="border-t border-border/50 bg-background/80 p-4 backdrop-blur-sm">
      <div className="mx-auto flex max-w-[1000px] items-end gap-3">
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          className={cn(
            'min-h-[56px] max-h-[200px] flex-1 resize-none rounded-3xl',
            'border-2 border-border/50 bg-secondary/30',
            'px-6 py-4 text-base',
            'placeholder:text-muted-foreground/60',
            'focus:border-primary focus:ring-2 focus:ring-primary/20',
            'transition-all duration-200'
          )}
          rows={1}
        />
        <Button
          onClick={handleSubmit}
          disabled={!canSend}
          size="icon"
          aria-label="Envoyer le message"
          className={cn(
            'size-12 shrink-0 rounded-full',
            'bg-primary hover:bg-primary/90',
            'shadow-lg shadow-primary/25',
            'disabled:opacity-50 disabled:shadow-none',
            'transition-all duration-200'
          )}
        >
          <Send className="size-5" />
        </Button>
      </div>
      <p className="mx-auto mt-2 max-w-[1000px] text-center text-xs text-muted-foreground/60">
        Appuyez sur{' '}
        <kbd className="rounded bg-secondary px-1.5 py-0.5 font-mono text-xs">
          Cmd
        </kbd>{' '}
        +{' '}
        <kbd className="rounded bg-secondary px-1.5 py-0.5 font-mono text-xs">
          Enter
        </kbd>{' '}
        pour envoyer
      </p>
    </div>
  )
}
