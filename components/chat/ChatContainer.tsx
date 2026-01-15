'use client'

import { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface ChatContainerProps {
  children: ReactNode
  className?: string
}

export function ChatContainer({ children, className }: ChatContainerProps) {
  return (
    <div className="h-full p-2 pb-0 sm:p-4 md:p-6">
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
