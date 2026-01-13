'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { useActiveRepo } from './useActiveRepo'
import { useIndexingStatus } from './useIndexingStatus'

/**
 * Hook to handle the ⌘+N (Mac) / Ctrl+N (Windows) keyboard shortcut
 * for creating a new conversation.
 *
 * This hook should be used at the dashboard layout level to ensure
 * the shortcut works globally across all dashboard pages.
 */
export function useNewConversationShortcut() {
  const router = useRouter()
  const { data: activeRepo } = useActiveRepo()
  const { isIndexed, isInProgress } = useIndexingStatus(activeRepo?.id)

  // Can only create new conversation if repo is indexed
  const canCreateConversation = activeRepo && isIndexed && !isInProgress

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

        if (!canCreateConversation) {
          if (!activeRepo) {
            toast.error('Selectionnez un repository')
          } else if (isInProgress) {
            toast.error('Indexation en cours...')
          } else {
            toast.error('Le repository doit être indexé')
          }
          return
        }

        router.push('/chat')
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [router, canCreateConversation, activeRepo, isInProgress])
}
