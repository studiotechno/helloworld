import { describe, it, expect } from 'vitest'
import {
  routeQuery,
  adjustForContext,
  getModelForQuery,
  estimateRoutingSavings,
} from './model-router'

describe('model-router', () => {
  describe('routeQuery', () => {
    describe('simple queries → Haiku', () => {
      it('should route "what is" queries to Haiku', () => {
        const result = routeQuery('What is the main function?')
        expect(result.model).toBe('haiku')
        expect(result.complexity).toBe('simple')
      })

      it('should route "list" queries to Haiku', () => {
        const result = routeQuery('List all API endpoints')
        expect(result.model).toBe('haiku')
        expect(result.complexity).toBe('simple')
      })

      it('should route short queries to Haiku', () => {
        const result = routeQuery('Show me the config')
        expect(result.model).toBe('haiku')
      })

      it('should route "find" queries to Haiku', () => {
        const result = routeQuery('Find the authentication module')
        expect(result.model).toBe('haiku')
      })
    })

    describe('complex queries → Sonnet', () => {
      it('should route "implement" queries to Sonnet', () => {
        const result = routeQuery('Implement a new caching layer for the API')
        expect(result.model).toBe('chat') // Sonnet
        expect(result.complexity).toBe('complex')
      })

      it('should route "refactor" queries to Sonnet', () => {
        const result = routeQuery('Refactor the authentication system')
        expect(result.model).toBe('chat')
        expect(result.complexity).toBe('complex')
      })

      it('should route "debug" queries to Sonnet', () => {
        const result = routeQuery('Debug why the tests are failing')
        expect(result.model).toBe('chat')
      })

      it('should route "why" queries to Sonnet', () => {
        const result = routeQuery('Why does this function return null?')
        expect(result.model).toBe('chat')
      })

      it('should route "analyze" queries to Sonnet', () => {
        const result = routeQuery('Analyze the performance of this code')
        expect(result.model).toBe('chat')
      })

      it('should route code generation patterns to Sonnet', () => {
        expect(routeQuery('Write a function to validate emails').model).toBe('chat')
        expect(routeQuery('Create a new service for payments').model).toBe('chat')
        expect(routeQuery('Implement a binary search algorithm').model).toBe('chat')
      })

      it('should route very long queries to Sonnet', () => {
        const longQuery = 'I need you to ' + 'analyze this code and '.repeat(10) + 'give me feedback'
        const result = routeQuery(longQuery)
        expect(result.model).toBe('chat')
        expect(result.complexity).toBe('complex')
      })
    })

    describe('forced model', () => {
      it('should respect forceModel option', () => {
        const result = routeQuery('What is the main function?', { forceModel: 'chat' })
        expect(result.model).toBe('chat')
        expect(result.reason).toBe('Model forced by option')
        expect(result.confidence).toBe(1.0)
      })

      it('should force Haiku when specified', () => {
        const result = routeQuery('Implement a complex system', { forceModel: 'haiku' })
        expect(result.model).toBe('haiku')
      })
    })

    describe('code generation preference', () => {
      it('should not route code generation to Haiku when preferSonnetForCode is true', () => {
        const result = routeQuery('Write some code for me', { preferSonnetForCode: true })
        expect(result.model).toBe('chat')
      })

      it('should allow code generation to route normally when preferSonnetForCode is false', () => {
        // This query would otherwise be simple
        const result = routeQuery('Show me the code', { preferSonnetForCode: false })
        expect(result.model).toBe('haiku')
      })
    })
  })

  describe('adjustForContext', () => {
    it('should upgrade Haiku to Sonnet for large contexts', () => {
      const analysis = {
        complexity: 'simple' as const,
        model: 'haiku' as const,
        reason: 'Simple query',
        confidence: 0.8,
      }

      const adjusted = adjustForContext(analysis, 6000, 5000)

      expect(adjusted.model).toBe('chat')
      expect(adjusted.reason).toContain('large context')
    })

    it('should not downgrade Sonnet to Haiku', () => {
      const analysis = {
        complexity: 'complex' as const,
        model: 'chat' as const,
        reason: 'Complex query',
        confidence: 0.9,
      }

      const adjusted = adjustForContext(analysis, 1000, 5000)

      expect(adjusted.model).toBe('chat') // Still Sonnet
    })

    it('should not upgrade for small contexts', () => {
      const analysis = {
        complexity: 'simple' as const,
        model: 'haiku' as const,
        reason: 'Simple query',
        confidence: 0.8,
      }

      const adjusted = adjustForContext(analysis, 2000, 5000)

      expect(adjusted.model).toBe('haiku')
    })
  })

  describe('getModelForQuery', () => {
    it('should return model and analysis', () => {
      const result = getModelForQuery('What is the config?')

      expect(result.model).toBeDefined()
      expect(result.analysis).toBeDefined()
      expect(result.analysis.model).toBe('haiku')
    })

    it('should adjust for context tokens', () => {
      const result = getModelForQuery('What is the config?', 10000)

      expect(result.analysis.model).toBe('chat') // Upgraded due to large context
    })
  })

  describe('estimateRoutingSavings', () => {
    it('should calculate savings for mixed queries', () => {
      const queries = [
        { query: 'What is X?' },
        { query: 'What is Y?' },
        { query: 'Implement a feature' },
        { query: 'List all endpoints' },
      ]

      const result = estimateRoutingSavings(queries)

      expect(result.totalQueries).toBe(4)
      expect(result.haikuQueries).toBeGreaterThan(0)
      expect(result.sonnetQueries).toBeGreaterThan(0)
      expect(result.estimatedSavingsPercent).toBeGreaterThan(0)
    })

    it('should report 0 savings when all queries use Sonnet', () => {
      const queries = [
        { query: 'Implement feature A' },
        { query: 'Refactor module B' },
        { query: 'Debug issue C' },
      ]

      const result = estimateRoutingSavings(queries)

      expect(result.haikuQueries).toBe(0)
      expect(result.sonnetQueries).toBe(3)
      expect(result.estimatedSavingsPercent).toBe(0)
    })

    it('should handle empty queries array', () => {
      const result = estimateRoutingSavings([])

      expect(result.totalQueries).toBe(0)
      expect(result.estimatedSavingsPercent).toBe(0)
    })
  })
})
