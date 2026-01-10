'use client'

import { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface ChatContainerProps {
  children: ReactNode
  className?: string
}

export function ChatContainer({ children, className }: ChatContainerProps) {
  return (
    <div
      className={cn(
        'mx-auto flex h-full max-w-[800px] flex-col',
        'px-4 md:px-12',
        className
      )}
    >
      {children}
    </div>
  )
}
