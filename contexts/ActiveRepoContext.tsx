'use client'

import { createContext, useContext, useEffect, ReactNode } from 'react'
import { useActiveRepo } from '@/hooks/useActiveRepo'
import type { ConnectedRepository } from '@/hooks/useConnectRepo'

interface ActiveRepoContextType {
  activeRepo: ConnectedRepository | null
  isLoading: boolean
  error: Error | null
  refetch: () => void
}

const ActiveRepoContext = createContext<ActiveRepoContextType | undefined>(undefined)

const STORAGE_KEY = 'techno:active-repo-id'

export function ActiveRepoProvider({ children }: { children: ReactNode }) {
  const { data: activeRepo, isLoading, error, refetch } = useActiveRepo()

  // Update localStorage when active repo changes (side effect only, no state)
  useEffect(() => {
    if (activeRepo?.id) {
      localStorage.setItem(STORAGE_KEY, activeRepo.id)
    } else if (activeRepo === null) {
      localStorage.removeItem(STORAGE_KEY)
    }
  }, [activeRepo])

  return (
    <ActiveRepoContext.Provider
      value={{
        activeRepo: activeRepo ?? null,
        isLoading,
        error: error as Error | null,
        refetch,
      }}
    >
      {children}
    </ActiveRepoContext.Provider>
  )
}

export function useActiveRepoContext() {
  const context = useContext(ActiveRepoContext)
  if (context === undefined) {
    throw new Error('useActiveRepoContext must be used within an ActiveRepoProvider')
  }
  return context
}

// Export helper to get cached repo ID for initial render optimization
export function getCachedActiveRepoId(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(STORAGE_KEY)
}
