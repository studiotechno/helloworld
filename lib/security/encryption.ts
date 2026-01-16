/**
 * Encryption Module
 *
 * Provides AES-256-GCM encryption for sensitive data like tokens.
 * Uses a secret key from environment variables.
 *
 * Usage:
 *   const encrypted = encrypt(plaintext)
 *   const decrypted = decrypt(encrypted)
 */

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto'

// Algorithm configuration
const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16
const AUTH_TAG_LENGTH = 16
const KEY_LENGTH = 32

// Cache the derived key
let derivedKey: Buffer | null = null

/**
 * Get or derive the encryption key from the secret
 */
function getKey(): Buffer {
  if (derivedKey) {
    return derivedKey
  }

  const secret = process.env.ENCRYPTION_SECRET
  if (!secret) {
    throw new Error('ENCRYPTION_SECRET environment variable is not set')
  }

  // Use a fixed salt for deterministic key derivation
  // In production, you might want to use a per-installation salt
  const salt = process.env.ENCRYPTION_SALT || 'phare-encryption-salt-v1'
  derivedKey = scryptSync(secret, salt, KEY_LENGTH)

  return derivedKey
}

/**
 * Encrypt a string
 * Returns: iv:authTag:ciphertext (all base64 encoded)
 */
export function encrypt(plaintext: string): string {
  if (!plaintext) {
    return ''
  }

  try {
    const key = getKey()
    const iv = randomBytes(IV_LENGTH)
    const cipher = createCipheriv(ALGORITHM, key, iv)

    let encrypted = cipher.update(plaintext, 'utf8', 'base64')
    encrypted += cipher.final('base64')

    const authTag = cipher.getAuthTag()

    // Format: iv:authTag:ciphertext
    return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`
  } catch (error) {
    console.error('[Encryption] Failed to encrypt:', error)
    throw new Error('Encryption failed')
  }
}

/**
 * Decrypt a string
 * Input format: iv:authTag:ciphertext (all base64 encoded)
 */
export function decrypt(encrypted: string): string {
  if (!encrypted) {
    return ''
  }

  try {
    const key = getKey()
    const parts = encrypted.split(':')

    if (parts.length !== 3) {
      // Not an encrypted value, return as-is (for backwards compatibility)
      console.warn('[Encryption] Value is not in encrypted format, returning as-is')
      return encrypted
    }

    const [ivBase64, authTagBase64, ciphertext] = parts
    const iv = Buffer.from(ivBase64, 'base64')
    const authTag = Buffer.from(authTagBase64, 'base64')

    const decipher = createDecipheriv(ALGORITHM, key, iv)
    decipher.setAuthTag(authTag)

    let decrypted = decipher.update(ciphertext, 'base64', 'utf8')
    decrypted += decipher.final('utf8')

    return decrypted
  } catch (error) {
    console.error('[Encryption] Failed to decrypt:', error)
    // Return empty string on decryption failure (token might be corrupted)
    return ''
  }
}

/**
 * Check if a value appears to be encrypted
 */
export function isEncrypted(value: string): boolean {
  if (!value) return false
  const parts = value.split(':')
  return parts.length === 3
}

/**
 * Safely encrypt a token (handles null/undefined)
 */
export function encryptToken(token: string | null | undefined): string | null {
  if (!token) return null

  // Check if ENCRYPTION_SECRET is configured
  if (!process.env.ENCRYPTION_SECRET) {
    console.warn('[Encryption] ENCRYPTION_SECRET not set, storing token unencrypted')
    return token
  }

  // Don't re-encrypt already encrypted values
  if (isEncrypted(token)) {
    return token
  }

  return encrypt(token)
}

/**
 * Safely decrypt a token (handles null/undefined and unencrypted values)
 */
export function decryptToken(encrypted: string | null | undefined): string | null {
  if (!encrypted) return null

  // Check if ENCRYPTION_SECRET is configured
  if (!process.env.ENCRYPTION_SECRET) {
    // No encryption configured, return as-is
    return encrypted
  }

  // Check if value is encrypted
  if (!isEncrypted(encrypted)) {
    // Not encrypted, return as-is (backwards compatibility)
    return encrypted
  }

  return decrypt(encrypted)
}
