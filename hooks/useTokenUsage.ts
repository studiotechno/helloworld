import { useQuery } from '@tanstack/react-query'
import type { TokenUsageResponse, TokenUsageError } from '@/types/token-usage'

/**
 * Hook to fetch user token usage statistics
 *
 * Uses react-query for caching and automatic refetching.
 * Stats are cached for 5 minutes since they only change after chat/indexing operations.
 */
export function useTokenUsage() {
  return useQuery<TokenUsageResponse, Error>({
    queryKey: ['user-token-usage'],
    queryFn: async () => {
      const response = await fetch('/api/user/usage')

      if (!response.ok) {
        const error: TokenUsageError = await response.json()
        throw new Error(error.error.message)
      }

      return response.json()
    },
    staleTime: 1000 * 60 * 5, // 5 minutes - stats change infrequently
    gcTime: 1000 * 60 * 10, // Keep in cache for 10 minutes
  })
}
