import { z } from 'zod'

// Repository schema matching database
export const repositorySchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  githubRepoId: z.string(),
  fullName: z.string(), // owner/repo format
  defaultBranch: z.string().default('main'),
  isActive: z.boolean().default(true),
  lastSyncedAt: z.date().nullable(),
  createdAt: z.date(),
})

export type Repository = z.infer<typeof repositorySchema>

// Connect repository request
export const connectRepoSchema = z.object({
  githubRepoId: z.string(),
  fullName: z.string().regex(/^[^/]+\/[^/]+$/, 'Must be in owner/repo format'),
  defaultBranch: z.string().optional(),
})

export type ConnectRepoInput = z.infer<typeof connectRepoSchema>

// Sync repository request
export const syncRepoSchema = z.object({
  repositoryId: z.string().uuid(),
})

export type SyncRepoInput = z.infer<typeof syncRepoSchema>
