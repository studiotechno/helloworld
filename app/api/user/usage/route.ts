import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getCurrentUser } from '@/lib/auth/sync-user'
import type { TokenUsageResponse, TokenSummary, UsageByModel } from '@/types/token-usage'

// Re-export types for backward compatibility
export type { TokenUsageResponse }

/** SQL result type for aggregation by type */
interface TypeAggregation {
  type: string
  input: bigint
  output: bigint
}

/** SQL result type for aggregation by model */
interface ModelAggregation {
  model: string
  input: bigint
  output: bigint
}

/**
 * GET /api/user/usage
 *
 * Returns aggregated token usage statistics for the authenticated user.
 * Uses SQL aggregation for optimal performance (vs loading all records in memory).
 */
export async function GET() {
  try {
    const user = await getCurrentUser()

    if (!user) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Non authentifie' } },
        { status: 401 }
      )
    }

    // Run all aggregations in parallel using SQL GROUP BY
    // This is ~100x faster than loading all records and aggregating in JS
    const [totalResult, byTypeResult, byModelResult] = await Promise.all([
      // Total aggregation
      prisma.token_usage.aggregate({
        where: { user_id: user.id },
        _sum: {
          input_tokens: true,
          output_tokens: true,
        },
      }),

      // Aggregation by type (chat vs indexing)
      prisma.$queryRaw<TypeAggregation[]>`
        SELECT
          type,
          COALESCE(SUM(input_tokens), 0) as input,
          COALESCE(SUM(output_tokens), 0) as output
        FROM token_usage
        WHERE user_id = ${user.id}::uuid
        GROUP BY type
      `,

      // Aggregation by model
      prisma.$queryRaw<ModelAggregation[]>`
        SELECT
          model,
          COALESCE(SUM(input_tokens), 0) as input,
          COALESCE(SUM(output_tokens), 0) as output
        FROM token_usage
        WHERE user_id = ${user.id}::uuid
        GROUP BY model
      `,
    ])

    // Build response from SQL results
    const total: TokenSummary = {
      input_tokens: totalResult._sum.input_tokens ?? 0,
      output_tokens: totalResult._sum.output_tokens ?? 0,
    }

    // Initialize type summaries
    const chat: TokenSummary = { input_tokens: 0, output_tokens: 0 }
    const indexing: TokenSummary = { input_tokens: 0, output_tokens: 0 }

    // Process by-type results
    for (const row of byTypeResult) {
      const input = Number(row.input)
      const output = Number(row.output)

      if (row.type === 'chat') {
        chat.input_tokens = input
        chat.output_tokens = output
      } else {
        // indexing_context or indexing_embedding -> aggregate into indexing
        indexing.input_tokens += input
        indexing.output_tokens += output
      }
    }

    // Process by-model results
    const by_model: UsageByModel = {}
    for (const row of byModelResult) {
      by_model[row.model] = {
        input: Number(row.input),
        output: Number(row.output),
      }
    }

    const response: TokenUsageResponse = {
      total,
      chat,
      indexing,
      by_model,
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('[API] Usage fetch error:', error)

    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: "Impossible de recuperer les statistiques d'usage",
        },
      },
      { status: 500 }
    )
  }
}
