import { describe, it, expect } from 'vitest'
import {
  CONFIDENCE_INSTRUCTIONS,
  PEDAGOGICAL_INSTRUCTIONS,
  PROFESSIONAL_VOCABULARY_INSTRUCTIONS,
  buildConfidencePrompt,
  CONFIDENCE_THRESHOLD,
} from './confidence'

describe('confidence utilities', () => {
  describe('CONFIDENCE_THRESHOLD', () => {
    it('should be 80', () => {
      expect(CONFIDENCE_THRESHOLD).toBe(80)
    })
  })

  describe('CONFIDENCE_INSTRUCTIONS', () => {
    it('should include binary confidence rules', () => {
      expect(CONFIDENCE_INSTRUCTIONS).toContain('confiance BINAIRE')
    })

    it('should include instructions for when certain', () => {
      expect(CONFIDENCE_INSTRUCTIONS).toContain('Quand tu ES CERTAIN')
      expect(CONFIDENCE_INSTRUCTIONS).toContain('Reponds directement et affirmativement')
    })

    it('should include instructions for when uncertain', () => {
      expect(CONFIDENCE_INSTRUCTIONS).toContain("Quand tu N'ES PAS CERTAIN")
      expect(CONFIDENCE_INSTRUCTIONS).toContain(
        'Je ne suis pas en mesure de repondre avec certitude'
      )
    })

    it('should include forbidden phrases', () => {
      expect(CONFIDENCE_INSTRUCTIONS).toContain('FORMULATIONS INTERDITES')
      expect(CONFIDENCE_INSTRUCTIONS).toContain('Peut-etre que')
      expect(CONFIDENCE_INSTRUCTIONS).toContain('Probablement')
      expect(CONFIDENCE_INSTRUCTIONS).toContain('Il y a X% de chances')
    })

    it('should include reformulation suggestions', () => {
      expect(CONFIDENCE_INSTRUCTIONS).toContain('Suggere comment l\'utilisateur pourrait reformuler')
    })
  })

  describe('PEDAGOGICAL_INSTRUCTIONS', () => {
    it('should include pedagogical structure', () => {
      expect(PEDAGOGICAL_INSTRUCTIONS).toContain('Style pedagogique')
      expect(PEDAGOGICAL_INSTRUCTIONS).toContain('Contextualiser')
      expect(PEDAGOGICAL_INSTRUCTIONS).toContain('Utiliser des analogies')
    })

    it('should include good and bad response examples', () => {
      expect(PEDAGOGICAL_INSTRUCTIONS).toContain('BONNE reponse')
      expect(PEDAGOGICAL_INSTRUCTIONS).toContain('MAUVAISE reponse')
    })

    it('should mention citation format', () => {
      expect(PEDAGOGICAL_INSTRUCTIONS).toContain('[chemin/fichier.ext:ligne]')
    })
  })

  describe('PROFESSIONAL_VOCABULARY_INSTRUCTIONS', () => {
    it('should include vocabulary guidance', () => {
      expect(PROFESSIONAL_VOCABULARY_INSTRUCTIONS).toContain('Vocabulaire professionnel')
    })

    it('should include things to do and avoid', () => {
      expect(PROFESSIONAL_VOCABULARY_INSTRUCTIONS).toContain('A FAIRE')
      expect(PROFESSIONAL_VOCABULARY_INSTRUCTIONS).toContain('A EVITER')
    })
  })

  describe('buildConfidencePrompt', () => {
    it('should combine all instruction sections', () => {
      const prompt = buildConfidencePrompt()

      expect(prompt).toContain('Gestion de la certitude')
      expect(prompt).toContain('Style pedagogique')
      expect(prompt).toContain('Vocabulaire professionnel')
    })

    it('should return a non-empty string', () => {
      const prompt = buildConfidencePrompt()
      expect(typeof prompt).toBe('string')
      expect(prompt.length).toBeGreaterThan(100)
    })
  })
})
