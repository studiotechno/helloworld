import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { CodeCitation } from './CodeCitation'
import { toast } from 'sonner'

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

// Mock clipboard API
const mockWriteText = vi.fn().mockResolvedValue(undefined)
Object.defineProperty(navigator, 'clipboard', {
  value: {
    writeText: mockWriteText,
  },
  writable: true,
})

describe('CodeCitation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('rendering', () => {
    it('should render file path', () => {
      render(<CodeCitation path="src/auth.ts" />)
      expect(screen.getByText('src/auth.ts')).toBeInTheDocument()
    })

    it('should render line number when provided', () => {
      render(<CodeCitation path="src/auth.ts" line={42} />)
      expect(screen.getByText(':42')).toBeInTheDocument()
    })

    it('should not render line number when not provided', () => {
      render(<CodeCitation path="src/auth.ts" />)
      expect(screen.queryByText(/:$/)).not.toBeInTheDocument()
    })

    it('should render file icon', () => {
      render(<CodeCitation path="src/auth.ts" />)
      // File icon should be present (aria-hidden)
      const button = screen.getByRole('button')
      expect(button.querySelector('svg')).toBeInTheDocument()
    })

    it('should render extension badge', () => {
      render(<CodeCitation path="src/auth.ts" />)
      expect(screen.getByText('ts')).toBeInTheDocument()
    })

    it('should render correct extension for different file types', () => {
      const { rerender } = render(<CodeCitation path="file.tsx" />)
      expect(screen.getByText('tsx')).toBeInTheDocument()

      rerender(<CodeCitation path="file.js" />)
      expect(screen.getByText('js')).toBeInTheDocument()

      rerender(<CodeCitation path="file.py" />)
      expect(screen.getByText('py')).toBeInTheDocument()
    })
  })

  describe('accessibility', () => {
    it('should have correct aria-label', () => {
      render(<CodeCitation path="src/auth.ts" />)
      expect(
        screen.getByRole('button', { name: /copier la citation: src\/auth\.ts/i })
      ).toBeInTheDocument()
    })

    it('should include line number in aria-label when provided', () => {
      render(<CodeCitation path="src/auth.ts" line={42} />)
      expect(
        screen.getByRole('button', {
          name: /copier la citation: src\/auth\.ts ligne 42/i,
        })
      ).toBeInTheDocument()
    })

    it('should be focusable', () => {
      render(<CodeCitation path="src/auth.ts" />)
      const button = screen.getByRole('button')
      button.focus()
      expect(button).toHaveFocus()
    })
  })

  describe('copy functionality', () => {
    it('should copy path to clipboard on click', async () => {
      render(<CodeCitation path="src/auth.ts" />)

      fireEvent.click(screen.getByRole('button'))

      await waitFor(() => {
        expect(mockWriteText).toHaveBeenCalledWith('src/auth.ts')
      })
    })

    it('should copy path with line number when provided', async () => {
      render(<CodeCitation path="src/auth.ts" line={42} />)

      fireEvent.click(screen.getByRole('button'))

      await waitFor(() => {
        expect(mockWriteText).toHaveBeenCalledWith('src/auth.ts:42')
      })
    })

    it('should show toast on successful copy', async () => {
      render(<CodeCitation path="src/auth.ts" />)

      fireEvent.click(screen.getByRole('button'))

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith('Copie !')
      })
    })

    it('should copy on Enter key press', async () => {
      render(<CodeCitation path="src/auth.ts" />)

      fireEvent.keyDown(screen.getByRole('button'), { key: 'Enter' })

      await waitFor(() => {
        expect(mockWriteText).toHaveBeenCalledWith('src/auth.ts')
      })
    })

    it('should copy on Space key press', async () => {
      render(<CodeCitation path="src/auth.ts" />)

      fireEvent.keyDown(screen.getByRole('button'), { key: ' ' })

      await waitFor(() => {
        expect(mockWriteText).toHaveBeenCalledWith('src/auth.ts')
      })
    })

    it('should show error toast on copy failure', async () => {
      mockWriteText.mockRejectedValueOnce(new Error('Copy failed'))

      render(<CodeCitation path="src/auth.ts" />)

      fireEvent.click(screen.getByRole('button'))

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Erreur lors de la copie')
      })
    })
  })

  describe('variants', () => {
    it('should apply inline variant classes by default', () => {
      render(<CodeCitation path="src/auth.ts" />)
      const button = screen.getByRole('button')
      expect(button).toHaveClass('px-1.5', 'py-0.5', 'text-xs')
    })

    it('should apply block variant classes when specified', () => {
      render(<CodeCitation path="src/auth.ts" variant="block" />)
      const button = screen.getByRole('button')
      expect(button).toHaveClass('px-2.5', 'py-1', 'text-sm')
    })
  })

  describe('hover effects', () => {
    it('should have hover scale class', () => {
      render(<CodeCitation path="src/auth.ts" />)
      const button = screen.getByRole('button')
      expect(button).toHaveClass('hover:scale-[1.02]')
    })

    it('should have hover shadow class', () => {
      render(<CodeCitation path="src/auth.ts" />)
      const button = screen.getByRole('button')
      expect(button.className).toContain('hover:shadow')
    })
  })

  describe('custom className', () => {
    it('should apply custom className', () => {
      render(<CodeCitation path="src/auth.ts" className="custom-class" />)
      expect(screen.getByRole('button')).toHaveClass('custom-class')
    })
  })
})
