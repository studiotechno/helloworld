import { describe, it, expect } from 'vitest'
import {
  ASSISTANT_IDENTITY,
  ASSISTANT_ROLE,
  FORMATTING_RULES,
  CITATION_FORMAT,
  buildBaseSystemPrompt,
  buildSystemPromptWithContext,
} from './base'

describe('base prompts', () => {
  describe('ASSISTANT_IDENTITY', () => {
    it('should define the assistant role for PMs', () => {
      expect(ASSISTANT_IDENTITY).toContain('Product Managers')
      expect(ASSISTANT_IDENTITY).toContain('entrepreneurs non-techniques')
    })

    it('should emphasize the colleague metaphor', () => {
      expect(ASSISTANT_IDENTITY).toContain('collegue technique')
    })
  })

  describe('ASSISTANT_ROLE', () => {
    it('should list key responsibilities', () => {
      expect(ASSISTANT_ROLE).toContain('Repondre aux questions')
      expect(ASSISTANT_ROLE).toContain('pedagogique')
      expect(ASSISTANT_ROLE).toContain('vocabulaire professionnel')
    })
  })

  describe('FORMATTING_RULES', () => {
    it('should specify French language', () => {
      expect(FORMATTING_RULES).toContain('francais')
    })

    it('should specify markdown formatting', () => {
      expect(FORMATTING_RULES).toContain('markdown')
    })

    it('should include citation format', () => {
      expect(FORMATTING_RULES).toContain('[chemin/vers/fichier.ext:ligne]')
    })
  })

  describe('CITATION_FORMAT', () => {
    it('should include citation examples', () => {
      expect(CITATION_FORMAT).toContain('[src/auth/login.ts:42]')
      expect(CITATION_FORMAT).toContain('[src/components/Button.tsx]')
    })
  })

  describe('buildBaseSystemPrompt', () => {
    it('should include all major sections', () => {
      const prompt = buildBaseSystemPrompt()

      // Identity section
      expect(prompt).toContain('Product Managers')

      // Role section
      expect(prompt).toContain('Ton role')

      // Confidence handling (from confidence.ts)
      expect(prompt).toContain('confiance BINAIRE')
      expect(prompt).toContain('Je ne suis pas en mesure de repondre')

      // Formatting
      expect(prompt).toContain('francais')
      expect(prompt).toContain('markdown')

      // Citations
      expect(prompt).toContain('Citations de code')
    })

    it('should not include repo context by default', () => {
      const prompt = buildBaseSystemPrompt()
      expect(prompt).not.toContain('Tu analyses le repository')
    })
  })

  describe('buildSystemPromptWithContext', () => {
    it('should include repo context when provided', () => {
      const prompt = buildSystemPromptWithContext({
        name: 'owner/my-repo',
        branch: 'main',
      })

      expect(prompt).toContain('owner/my-repo')
      expect(prompt).toContain('main')
      expect(prompt).toContain('Tu analyses le repository')
    })

    it('should work without repo context', () => {
      const prompt = buildSystemPromptWithContext()
      expect(prompt).not.toContain('Tu analyses le repository')
    })

    it('should include all base prompt sections', () => {
      const prompt = buildSystemPromptWithContext({
        name: 'test/repo',
        branch: 'develop',
      })

      // Base sections should still be present
      expect(prompt).toContain('Product Managers')
      expect(prompt).toContain('confiance BINAIRE')
    })
  })
})
