'use client'

import { ArrowDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface ScrollToBottomProps {
  onClick: () => void
  visible: boolean
  className?: string
}

export function ScrollToBottom({ onClick, visible, className }: ScrollToBottomProps) {
  if (!visible) return null

  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={onClick}
      className={cn(
        'absolute bottom-24 left-1/2 -translate-x-1/2',
        'flex items-center gap-2 rounded-full px-4 py-2',
        'bg-secondary/90 backdrop-blur-sm',
        'shadow-lg shadow-black/10',
        'transition-all duration-200',
        'hover:bg-secondary hover:shadow-xl',
        'animate-in fade-in slide-in-from-bottom-4',
        className
      )}
      aria-label="Retour en bas"
    >
      <ArrowDown className="size-4" />
      <span className="text-sm">Retour en bas</span>
    </Button>
  )
}
