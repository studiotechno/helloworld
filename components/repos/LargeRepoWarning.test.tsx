import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import {
  LargeRepoWarning,
  isLargeRepository,
  LARGE_REPO_THRESHOLD,
} from './LargeRepoWarning'

describe('LargeRepoWarning', () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    repositoryName: 'owner/large-repo',
    estimatedLines: 75000,
    totalFiles: 500,
    codeFiles: 350,
    onProceed: vi.fn(),
    onCancel: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('rendering', () => {
    it('should render warning title', () => {
      render(<LargeRepoWarning {...defaultProps} />)

      expect(screen.getByText('Repository volumineux detecte')).toBeInTheDocument()
    })

    it('should display repository name', () => {
      render(<LargeRepoWarning {...defaultProps} />)

      expect(screen.getByText('owner/large-repo')).toBeInTheDocument()
    })

    it('should display estimated lines formatted', () => {
      render(<LargeRepoWarning {...defaultProps} />)

      expect(screen.getByText('75k')).toBeInTheDocument()
    })

    it('should display code files count', () => {
      render(<LargeRepoWarning {...defaultProps} />)

      expect(screen.getByText('350')).toBeInTheDocument()
      expect(screen.getByText('fichiers code')).toBeInTheDocument()
    })

    it('should display estimated time', () => {
      render(<LargeRepoWarning {...defaultProps} />)

      // 75000 lines / 1000 = 75 seconds = ~2 minutes
      expect(screen.getByText('~2 minutes')).toBeInTheDocument()
    })

    it('should display priority folders info', () => {
      render(<LargeRepoWarning {...defaultProps} />)

      expect(screen.getByText(/Seuls les dossiers prioritaires/)).toBeInTheDocument()
      expect(screen.getByText(/src, lib, app/)).toBeInTheDocument()
    })

    it('should display proceed and cancel buttons', () => {
      render(<LargeRepoWarning {...defaultProps} />)

      expect(screen.getByRole('button', { name: /Continuer l'indexation/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Annuler/i })).toBeInTheDocument()
    })
  })

  describe('number formatting', () => {
    it('should format small numbers as-is', () => {
      render(<LargeRepoWarning {...defaultProps} estimatedLines={500} />)

      expect(screen.getByText('500')).toBeInTheDocument()
    })

    it('should format thousands with k suffix', () => {
      render(<LargeRepoWarning {...defaultProps} estimatedLines={12500} />)

      expect(screen.getByText('13k')).toBeInTheDocument()
    })

    it('should format millions with M suffix', () => {
      render(<LargeRepoWarning {...defaultProps} estimatedLines={1500000} />)

      expect(screen.getByText('1.5M')).toBeInTheDocument()
    })
  })

  describe('time estimation', () => {
    it('should show seconds for small repos', () => {
      render(<LargeRepoWarning {...defaultProps} estimatedLines={30000} />)

      // 30000 / 1000 = 30 seconds
      expect(screen.getByText('~30 secondes')).toBeInTheDocument()
    })

    it('should show minutes for medium repos', () => {
      render(<LargeRepoWarning {...defaultProps} estimatedLines={120000} />)

      // 120000 / 1000 = 120 seconds = 2 minutes
      expect(screen.getByText('~2 minutes')).toBeInTheDocument()
    })

    it('should show hours for very large repos', () => {
      render(<LargeRepoWarning {...defaultProps} estimatedLines={5000000} />)

      // 5000000 / 1000 = 5000 seconds = ~84 minutes = ~2 hours
      expect(screen.getByText('~2 heures')).toBeInTheDocument()
    })
  })

  describe('interactions', () => {
    it('should call onProceed when proceed button clicked', () => {
      const onProceed = vi.fn()
      render(<LargeRepoWarning {...defaultProps} onProceed={onProceed} />)

      fireEvent.click(screen.getByRole('button', { name: /Continuer l'indexation/i }))

      expect(onProceed).toHaveBeenCalledTimes(1)
    })

    it('should call onCancel when cancel button clicked', () => {
      const onCancel = vi.fn()
      render(<LargeRepoWarning {...defaultProps} onCancel={onCancel} />)

      fireEvent.click(screen.getByRole('button', { name: /Annuler/i }))

      expect(onCancel).toHaveBeenCalledTimes(1)
    })

    it('should call onOpenChange(false) when cancel clicked', () => {
      const onOpenChange = vi.fn()
      render(<LargeRepoWarning {...defaultProps} onOpenChange={onOpenChange} />)

      fireEvent.click(screen.getByRole('button', { name: /Annuler/i }))

      expect(onOpenChange).toHaveBeenCalledWith(false)
    })
  })

  describe('loading state', () => {
    it('should show loading text when isLoading', () => {
      render(<LargeRepoWarning {...defaultProps} isLoading={true} />)

      expect(screen.getByRole('button', { name: /Demarrage.../i })).toBeInTheDocument()
    })

    it('should disable buttons when isLoading', () => {
      render(<LargeRepoWarning {...defaultProps} isLoading={true} />)

      expect(screen.getByRole('button', { name: /Demarrage.../i })).toBeDisabled()
      expect(screen.getByRole('button', { name: /Annuler/i })).toBeDisabled()
    })
  })

  describe('optional props', () => {
    it('should render without codeFiles', () => {
      const { codeFiles: _codeFiles, ...propsWithoutCodeFiles } = defaultProps
      render(<LargeRepoWarning {...propsWithoutCodeFiles} />)

      expect(screen.queryByText('fichiers code')).not.toBeInTheDocument()
    })

    it('should not show dialog when open is false', () => {
      render(<LargeRepoWarning {...defaultProps} open={false} />)

      expect(screen.queryByText('Repository volumineux detecte')).not.toBeInTheDocument()
    })
  })
})

describe('isLargeRepository', () => {
  it('should return false for repos under threshold', () => {
    expect(isLargeRepository(49999)).toBe(false)
    expect(isLargeRepository(50000)).toBe(false)
    expect(isLargeRepository(0)).toBe(false)
    expect(isLargeRepository(10000)).toBe(false)
  })

  it('should return true for repos over threshold', () => {
    expect(isLargeRepository(50001)).toBe(true)
    expect(isLargeRepository(100000)).toBe(true)
    expect(isLargeRepository(1000000)).toBe(true)
  })
})

describe('LARGE_REPO_THRESHOLD', () => {
  it('should be 50000 lines', () => {
    expect(LARGE_REPO_THRESHOLD).toBe(50000)
  })
})
