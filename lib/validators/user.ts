import { z } from 'zod'

// User schema matching database
export const userSchema = z.object({
  id: z.string().uuid(),
  githubId: z.string(),
  email: z.string().email().nullable(),
  name: z.string().nullable(),
  avatarUrl: z.string().url().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
})

export type User = z.infer<typeof userSchema>

// User creation from GitHub OAuth
export const createUserFromGitHubSchema = z.object({
  githubId: z.string(),
  email: z.string().email().nullable(),
  name: z.string().nullable(),
  avatarUrl: z.string().url().nullable(),
})

export type CreateUserFromGitHub = z.infer<typeof createUserFromGitHubSchema>
