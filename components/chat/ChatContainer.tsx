'use client'

import { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface ChatContainerProps {
  children: ReactNode
  className?: string
}

export function ChatContainer({ children, className }: ChatContainerProps) {
  return (
    <div className="h-full p-6 pb-0">
      <div
        className={cn(
          'mx-auto flex h-full max-w-6xl flex-col',
          className
        )}
      >
        {children}
      </div>
    </div>
  )
}
