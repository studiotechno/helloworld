import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AnalysisLoader } from './AnalysisLoader'

describe('AnalysisLoader', () => {
  describe('rendering', () => {
    it('should render with loading phase', () => {
      render(<AnalysisLoader phase="loading" />)
      expect(screen.getByText('Analyse en cours...')).toBeInTheDocument()
    })

    it('should render with scanning phase', () => {
      render(<AnalysisLoader phase="scanning" />)
      expect(screen.getByText('Lecture des fichiers...')).toBeInTheDocument()
    })

    it('should render with processing phase', () => {
      render(<AnalysisLoader phase="processing" />)
      expect(screen.getByText('Traitement des resultats...')).toBeInTheDocument()
    })

    it('should render with timeout phase', () => {
      render(<AnalysisLoader phase="timeout" />)
      expect(
        screen.getByText('Cette analyse prend plus de temps que prevu...')
      ).toBeInTheDocument()
    })

    it('should render custom message when provided', () => {
      render(<AnalysisLoader phase="loading" message="Custom loading message" />)
      expect(screen.getByText('Custom loading message')).toBeInTheDocument()
    })
  })

  describe('progress display', () => {
    it('should not show progress in loading phase', () => {
      render(
        <AnalysisLoader
          phase="loading"
          filesAnalyzed={100}
          foldersAnalyzed={5}
        />
      )
      expect(screen.queryByText(/fichiers analyses/)).not.toBeInTheDocument()
    })

    it('should show progress in scanning phase', () => {
      render(
        <AnalysisLoader
          phase="scanning"
          filesAnalyzed={100}
          foldersAnalyzed={5}
        />
      )
      expect(screen.getByText(/fichiers analyses dans/)).toBeInTheDocument()
      expect(screen.getByText(/dossiers/)).toBeInTheDocument()
    })

    it('should show progress in processing phase', () => {
      render(
        <AnalysisLoader
          phase="processing"
          filesAnalyzed={500}
          foldersAnalyzed={10}
        />
      )
      expect(screen.getByText(/fichiers analyses dans/)).toBeInTheDocument()
    })

    it('should not show progress when filesAnalyzed is 0', () => {
      render(<AnalysisLoader phase="scanning" filesAnalyzed={0} />)
      expect(screen.queryByText(/fichiers analyses/)).not.toBeInTheDocument()
    })
  })

  describe('cancel button', () => {
    it('should not show cancel button in non-timeout phases', () => {
      render(<AnalysisLoader phase="loading" onCancel={() => {}} />)
      expect(screen.queryByRole('button', { name: /annuler/i })).not.toBeInTheDocument()
    })

    it('should show cancel button in timeout phase when onCancel provided', () => {
      render(<AnalysisLoader phase="timeout" onCancel={() => {}} />)
      expect(screen.getByRole('button', { name: /annuler/i })).toBeInTheDocument()
    })

    it('should not show cancel button in timeout phase when onCancel not provided', () => {
      render(<AnalysisLoader phase="timeout" />)
      expect(screen.queryByRole('button', { name: /annuler/i })).not.toBeInTheDocument()
    })

    it('should call onCancel when cancel button is clicked', () => {
      const onCancel = vi.fn()
      render(<AnalysisLoader phase="timeout" onCancel={onCancel} />)

      fireEvent.click(screen.getByRole('button', { name: /annuler/i }))
      expect(onCancel).toHaveBeenCalledTimes(1)
    })
  })

  describe('accessibility', () => {
    it('should have role="status"', () => {
      render(<AnalysisLoader phase="loading" />)
      expect(screen.getByRole('status')).toBeInTheDocument()
    })

    it('should have aria-live="polite"', () => {
      render(<AnalysisLoader phase="loading" />)
      expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite')
    })

    it('should have descriptive aria-label', () => {
      render(<AnalysisLoader phase="loading" message="Test message" />)
      expect(screen.getByRole('status')).toHaveAttribute(
        'aria-label',
        'Analyse en cours: Test message'
      )
    })
  })

  describe('animation classes', () => {
    it('should have motion-safe animation classes for reduced motion support', () => {
      render(<AnalysisLoader phase="loading" />)
      const container = screen.getByRole('status')
      const icon = container.querySelector('svg')
      expect(icon).toHaveClass('motion-safe:animate-pulse')
    })
  })

  describe('styling', () => {
    it('should apply custom className', () => {
      render(<AnalysisLoader phase="loading" className="custom-class" />)
      expect(screen.getByRole('status')).toHaveClass('custom-class')
    })
  })
})
