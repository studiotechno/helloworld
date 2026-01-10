'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Hook to handle the ⌘+N (Mac) / Ctrl+N (Windows) keyboard shortcut
 * for creating a new conversation.
 *
 * This hook should be used at the dashboard layout level to ensure
 * the shortcut works globally across all dashboard pages.
 */
export function useNewConversationShortcut() {
  const router = useRouter()

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Check for ⌘+N (Mac) or Ctrl+N (Windows/Linux)
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'n') {
        // Don't intercept if user is typing in an input or textarea
        const activeElement = document.activeElement
        const isInputFocused =
          activeElement instanceof HTMLInputElement ||
          activeElement instanceof HTMLTextAreaElement ||
          activeElement?.getAttribute('contenteditable') === 'true'

        if (isInputFocused) {
          return
        }

        event.preventDefault()
        router.push('/chat')
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [router])
}
