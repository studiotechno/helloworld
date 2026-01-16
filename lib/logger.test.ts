import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createLogger } from './logger'

describe('Logger', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('createLogger', () => {
    it('should create a namespaced logger', () => {
      const logger = createLogger('TestNamespace')

      expect(logger.debug).toBeDefined()
      expect(logger.info).toBeDefined()
      expect(logger.warn).toBeDefined()
      expect(logger.error).toBeDefined()
    })
  })

  describe('sensitive data redaction', () => {
    it('should redact Bearer tokens', () => {
      const logger = createLogger('Test')
      logger.info('Auth header: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.xxx')

      expect(consoleSpy).toHaveBeenCalled()
      const logOutput = consoleSpy.mock.calls[0][0]
      expect(logOutput).toContain('[REDACTED]')
      expect(logOutput).not.toContain('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9')
    })

    it('should redact GitHub tokens', () => {
      const logger = createLogger('Test')
      logger.info('Token: ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx')

      expect(consoleSpy).toHaveBeenCalled()
      const logOutput = consoleSpy.mock.calls[0][0]
      expect(logOutput).toContain('[REDACTED]')
      expect(logOutput).not.toContain('ghp_')
    })

    it('should redact Stripe keys', () => {
      const logger = createLogger('Test')
      logger.info('Key: sk_test_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx')

      expect(consoleSpy).toHaveBeenCalled()
      const logOutput = consoleSpy.mock.calls[0][0]
      expect(logOutput).toContain('[REDACTED]')
      expect(logOutput).not.toContain('sk_test_')
    })

    it('should redact sensitive context keys', () => {
      const logger = createLogger('Test')
      logger.info('User action', {
        userId: 'user-123',
        token: 'secret-token-value',
        apiKey: 'my-api-key',
        password: 'my-password',
      })

      expect(consoleSpy).toHaveBeenCalled()
      const logOutput = consoleSpy.mock.calls[0][0]

      // Should contain user ID (not sensitive)
      expect(logOutput).toContain('user-123')

      // Should redact sensitive fields
      expect(logOutput).toContain('[REDACTED]')
      expect(logOutput).not.toContain('secret-token-value')
      expect(logOutput).not.toContain('my-api-key')
      expect(logOutput).not.toContain('my-password')
    })

    it('should handle nested objects', () => {
      const logger = createLogger('Test')
      logger.info('Config', {
        user: {
          id: 'user-123',
          credentials: {
            token: 'secret-token',
          },
        },
      })

      expect(consoleSpy).toHaveBeenCalled()
      const logOutput = consoleSpy.mock.calls[0][0]
      expect(logOutput).toContain('user-123')
      expect(logOutput).not.toContain('secret-token')
    })
  })

  describe('log levels', () => {
    it('should call console.error for error level', () => {
      const errorSpy = vi.spyOn(console, 'error')
      const logger = createLogger('Test')

      logger.error('An error occurred')

      expect(errorSpy).toHaveBeenCalled()
    })

    it('should call console.warn for warn level', () => {
      const warnSpy = vi.spyOn(console, 'warn')
      const logger = createLogger('Test')

      logger.warn('A warning')

      expect(warnSpy).toHaveBeenCalled()
    })
  })
})
