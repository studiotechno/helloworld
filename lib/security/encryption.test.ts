import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// Store original env
const originalEnv = process.env

describe('Encryption', () => {
  beforeEach(() => {
    // Reset modules to clear cached key
    vi.resetModules()
    // Set up test environment
    process.env = {
      ...originalEnv,
      ENCRYPTION_SECRET: 'test-secret-key-for-testing-only-32chars',
      ENCRYPTION_SALT: 'test-salt',
    }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  describe('encrypt/decrypt', () => {
    it('should encrypt and decrypt a string correctly', async () => {
      const { encrypt, decrypt } = await import('./encryption')

      const plaintext = 'my-secret-token-12345'
      const encrypted = encrypt(plaintext)

      // Encrypted should be different from plaintext
      expect(encrypted).not.toBe(plaintext)

      // Encrypted should be in format iv:authTag:ciphertext
      expect(encrypted.split(':').length).toBe(3)

      // Decryption should return original value
      const decrypted = decrypt(encrypted)
      expect(decrypted).toBe(plaintext)
    })

    it('should produce different ciphertext for same plaintext (due to random IV)', async () => {
      const { encrypt } = await import('./encryption')

      const plaintext = 'same-secret'
      const encrypted1 = encrypt(plaintext)
      const encrypted2 = encrypt(plaintext)

      // Different encryptions should produce different ciphertext
      expect(encrypted1).not.toBe(encrypted2)
    })

    it('should handle empty strings', async () => {
      const { encrypt, decrypt } = await import('./encryption')

      expect(encrypt('')).toBe('')
      expect(decrypt('')).toBe('')
    })

    it('should handle special characters', async () => {
      const { encrypt, decrypt } = await import('./encryption')

      const specialChars = '!@#$%^&*()_+-=[]{}|;:,.<>?`~éàü中文'
      const encrypted = encrypt(specialChars)
      const decrypted = decrypt(encrypted)

      expect(decrypted).toBe(specialChars)
    })

    it('should handle long strings', async () => {
      const { encrypt, decrypt } = await import('./encryption')

      const longString = 'a'.repeat(10000)
      const encrypted = encrypt(longString)
      const decrypted = decrypt(encrypted)

      expect(decrypted).toBe(longString)
    })
  })

  describe('isEncrypted', () => {
    it('should detect encrypted values', async () => {
      const { encrypt, isEncrypted } = await import('./encryption')

      const encrypted = encrypt('test')
      expect(isEncrypted(encrypted)).toBe(true)
    })

    it('should detect non-encrypted values', async () => {
      const { isEncrypted } = await import('./encryption')

      expect(isEncrypted('plain-text')).toBe(false)
      expect(isEncrypted('ghp_xxxxxxxxxxxxx')).toBe(false)
      expect(isEncrypted('')).toBe(false)
    })
  })

  describe('encryptToken/decryptToken', () => {
    it('should handle null/undefined values', async () => {
      const { encryptToken, decryptToken } = await import('./encryption')

      expect(encryptToken(null)).toBe(null)
      expect(encryptToken(undefined)).toBe(null)
      expect(decryptToken(null)).toBe(null)
      expect(decryptToken(undefined)).toBe(null)
    })

    it('should encrypt and decrypt tokens', async () => {
      const { encryptToken, decryptToken } = await import('./encryption')

      const token = 'ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'
      const encrypted = encryptToken(token)
      const decrypted = decryptToken(encrypted)

      expect(decrypted).toBe(token)
    })

    it('should not re-encrypt already encrypted values', async () => {
      const { encryptToken } = await import('./encryption')

      const token = 'my-token'
      const encrypted1 = encryptToken(token)
      const encrypted2 = encryptToken(encrypted1)

      // Should be the same (not double-encrypted)
      expect(encrypted1).toBe(encrypted2)
    })

    it('should return unencrypted values as-is when decrypting', async () => {
      const { decryptToken } = await import('./encryption')

      const plainToken = 'ghp_plaintoken'
      const result = decryptToken(plainToken)

      // Should return as-is for backwards compatibility
      expect(result).toBe(plainToken)
    })
  })

  describe('without ENCRYPTION_SECRET', () => {
    beforeEach(() => {
      vi.resetModules()
      process.env = { ...originalEnv }
      delete process.env.ENCRYPTION_SECRET
    })

    it('should store tokens unencrypted when secret is not set', async () => {
      const { encryptToken, decryptToken } = await import('./encryption')

      const token = 'my-unencrypted-token'
      const result = encryptToken(token)

      // Should return the token as-is
      expect(result).toBe(token)

      // Decryption should also return as-is
      expect(decryptToken(result)).toBe(token)
    })
  })
})
