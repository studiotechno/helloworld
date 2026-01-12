import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

interface UserInstructions {
  profile_instructions: string | null
  team_instructions: string | null
}

interface InstructionsResponse {
  instructions: UserInstructions
}

interface InstructionsError {
  error: {
    code: string
    message: string
  }
}

/**
 * Hook to fetch user instructions
 */
export function useUserInstructions() {
  return useQuery<UserInstructions, Error>({
    queryKey: ['user-instructions'],
    queryFn: async () => {
      const response = await fetch('/api/user/instructions')

      if (!response.ok) {
        const error: InstructionsError = await response.json()
        throw new Error(error.error.message)
      }

      const data: InstructionsResponse = await response.json()
      return data.instructions
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  })
}

/**
 * Hook to update user instructions
 */
export function useUpdateUserInstructions() {
  const queryClient = useQueryClient()

  return useMutation<UserInstructions, Error, Partial<UserInstructions>>({
    mutationFn: async (updates) => {
      const response = await fetch('/api/user/instructions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })

      if (!response.ok) {
        const error: InstructionsError = await response.json()
        throw new Error(error.error.message)
      }

      const data: InstructionsResponse = await response.json()
      return data.instructions
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['user-instructions'], data)
    },
  })
}
