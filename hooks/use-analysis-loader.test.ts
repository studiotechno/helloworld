import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useAnalysisLoader } from './use-analysis-loader'

describe('useAnalysisLoader', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('initial state', () => {
    it('should return idle phase when not loading', () => {
      const { result } = renderHook(() => useAnalysisLoader(false))

      expect(result.current.phase).toBe('idle')
      expect(result.current.showLoader).toBe(false)
      expect(result.current.filesAnalyzed).toBe(0)
      expect(result.current.foldersAnalyzed).toBe(0)
    })

    it('should return idle phase initially when loading starts', () => {
      const { result } = renderHook(() => useAnalysisLoader(true))

      expect(result.current.phase).toBe('idle')
      expect(result.current.showLoader).toBe(false)
    })
  })

  describe('phase transitions', () => {
    it('should transition to loading phase after 2 seconds', () => {
      const { result } = renderHook(() => useAnalysisLoader(true))

      act(() => {
        vi.advanceTimersByTime(2100)
      })

      expect(result.current.phase).toBe('loading')
      expect(result.current.showLoader).toBe(true)
      expect(result.current.message).toBe('Analyse en cours...')
    })

    it('should transition to scanning phase after 5 seconds', () => {
      const { result } = renderHook(() => useAnalysisLoader(true))

      act(() => {
        vi.advanceTimersByTime(5100)
      })

      expect(result.current.phase).toBe('scanning')
      expect(result.current.message).toBe('Lecture des fichiers...')
    })

    it('should transition to processing phase after 15 seconds', () => {
      const { result } = renderHook(() => useAnalysisLoader(true))

      act(() => {
        vi.advanceTimersByTime(15100)
      })

      expect(result.current.phase).toBe('processing')
      expect(result.current.message).toBe('Traitement des resultats...')
    })

    it('should transition to timeout phase after 30 seconds', () => {
      const { result } = renderHook(() => useAnalysisLoader(true))

      act(() => {
        vi.advanceTimersByTime(30100)
      })

      expect(result.current.phase).toBe('timeout')
      expect(result.current.message).toBe(
        'Cette analyse prend plus de temps que prevu...'
      )
    })
  })

  describe('file progress', () => {
    it('should not show file count in loading phase', () => {
      const { result } = renderHook(() => useAnalysisLoader(true))

      act(() => {
        vi.advanceTimersByTime(3000)
      })

      expect(result.current.phase).toBe('loading')
      expect(result.current.filesAnalyzed).toBe(0)
    })

    it('should increment file count in scanning phase', () => {
      const { result } = renderHook(() => useAnalysisLoader(true))

      act(() => {
        vi.advanceTimersByTime(7000)
      })

      expect(result.current.phase).toBe('scanning')
      expect(result.current.filesAnalyzed).toBeGreaterThan(0)
    })

    it('should cap file count at maximum', () => {
      const { result } = renderHook(() => useAnalysisLoader(true))

      act(() => {
        vi.advanceTimersByTime(60000)
      })

      expect(result.current.filesAnalyzed).toBeLessThanOrEqual(847)
    })

    it('should calculate folder count based on file count', () => {
      const { result } = renderHook(() => useAnalysisLoader(true))

      act(() => {
        vi.advanceTimersByTime(15000)
      })

      const expectedFolders = Math.min(
        Math.floor(result.current.filesAnalyzed / 70),
        12
      )
      expect(result.current.foldersAnalyzed).toBe(expectedFolders)
    })
  })

  describe('loading state changes', () => {
    it('should reset state when loading becomes false', () => {
      const { result, rerender } = renderHook(
        ({ isLoading }) => useAnalysisLoader(isLoading),
        { initialProps: { isLoading: true } }
      )

      act(() => {
        vi.advanceTimersByTime(10000)
      })

      expect(result.current.phase).toBe('scanning')

      rerender({ isLoading: false })

      expect(result.current.phase).toBe('idle')
      expect(result.current.showLoader).toBe(false)
      expect(result.current.filesAnalyzed).toBe(0)
    })

    it('should start fresh when loading restarts', () => {
      const { result, rerender } = renderHook(
        ({ isLoading }) => useAnalysisLoader(isLoading),
        { initialProps: { isLoading: true } }
      )

      act(() => {
        vi.advanceTimersByTime(10000)
      })

      rerender({ isLoading: false })
      rerender({ isLoading: true })

      expect(result.current.phase).toBe('idle')

      act(() => {
        vi.advanceTimersByTime(2100)
      })

      expect(result.current.phase).toBe('loading')
    })
  })

  describe('reset function', () => {
    it('should reset all state when reset is called', () => {
      const { result } = renderHook(() => useAnalysisLoader(true))

      act(() => {
        vi.advanceTimersByTime(10000)
      })

      expect(result.current.phase).toBe('scanning')

      act(() => {
        result.current.reset()
      })

      expect(result.current.phase).toBe('idle')
      expect(result.current.showLoader).toBe(false)
      expect(result.current.filesAnalyzed).toBe(0)
    })
  })

  describe('elapsed time tracking', () => {
    it('should track elapsed time', () => {
      const { result } = renderHook(() => useAnalysisLoader(true))

      act(() => {
        vi.advanceTimersByTime(5000)
      })

      expect(result.current.elapsedTime).toBeGreaterThanOrEqual(5)
    })
  })
})
