import { PrismaClient } from '@prisma/client'

// ✅ DEBUG TEMPORAIRE
console.log('[env] NODE_ENV:', process.env.NODE_ENV)
console.log('[env] has DATABASE_URL:', !!process.env.DATABASE_URL)
console.log(
  '[env] DATABASE_URL host:',
  process.env.DATABASE_URL?.split('@')[1]?.split('/')[0]
)

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
