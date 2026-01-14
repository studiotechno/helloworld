import { useQuery } from '@tanstack/react-query'
import type { SubscriptionResponse } from '@/app/api/user/subscription/route'

interface SubscriptionError {
  error: {
    code: string
    message: string
  }
}

/**
 * Hook to fetch user subscription details and usage limits
 */
export function useSubscription() {
  return useQuery<SubscriptionResponse, Error>({
    queryKey: ['user-subscription'],
    queryFn: async () => {
      const response = await fetch('/api/user/subscription')

      if (!response.ok) {
        const error: SubscriptionError = await response.json()
        throw new Error(error.error.message)
      }

      return response.json()
    },
    staleTime: 1000 * 60 * 2, // 2 minutes - subscription data can change
    gcTime: 1000 * 60 * 10, // Keep in cache for 10 minutes
  })
}
