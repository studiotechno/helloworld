'use client'

import { createContext, useContext, ReactNode, useMemo } from 'react'

interface CitationContextValue {
  /**
   * Base URL for GitHub file links
   * e.g., "https://github.com/owner/repo/blob/main"
   */
  githubBaseUrl: string | null
  /**
   * Repository full name (owner/repo)
   */
  repoFullName: string | null
}

const CitationContext = createContext<CitationContextValue>({
  githubBaseUrl: null,
  repoFullName: null,
})

interface CitationProviderProps {
  children: ReactNode
  /**
   * Repository full name (e.g., "owner/repo")
   */
  repoFullName?: string | null
  /**
   * Default branch (e.g., "main")
   */
  defaultBranch?: string | null
}

export function CitationProvider({
  children,
  repoFullName,
  defaultBranch = 'main',
}: CitationProviderProps) {
  const value = useMemo(() => {
    if (!repoFullName) {
      return { githubBaseUrl: null, repoFullName: null }
    }

    const githubBaseUrl = `https://github.com/${repoFullName}/blob/${defaultBranch || 'main'}`

    return {
      githubBaseUrl,
      repoFullName,
    }
  }, [repoFullName, defaultBranch])

  return (
    <CitationContext.Provider value={value}>
      {children}
    </CitationContext.Provider>
  )
}

export function useCitationContext() {
  return useContext(CitationContext)
}
