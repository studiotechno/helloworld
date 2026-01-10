import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DeleteAccountDialog } from './DeleteAccountDialog'

const mockPush = vi.fn()
const mockRefresh = vi.fn()

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: mockRefresh,
  }),
}))

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

// Mock fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('DeleteAccountDialog', () => {
  const mockOnOpenChange = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    })
  })

  it('renders warning message when open', () => {
    render(<DeleteAccountDialog open={true} onOpenChange={mockOnOpenChange} />)

    expect(screen.getByText('Supprimer votre compte')).toBeInTheDocument()
    expect(screen.getByText(/irréversible/)).toBeInTheDocument()
    expect(screen.getByText('Votre profil utilisateur')).toBeInTheDocument()
    expect(screen.getByText('Vos repositories connectés')).toBeInTheDocument()
    expect(screen.getByText('Toutes vos conversations et messages')).toBeInTheDocument()
  })

  it('shows SUPPRIMER confirmation requirement', () => {
    render(<DeleteAccountDialog open={true} onOpenChange={mockOnOpenChange} />)

    expect(screen.getByText('SUPPRIMER')).toBeInTheDocument()
    expect(screen.getByTestId('confirmation-input')).toBeInTheDocument()
  })

  it('has disabled confirm button by default', () => {
    render(<DeleteAccountDialog open={true} onOpenChange={mockOnOpenChange} />)

    const confirmButton = screen.getByTestId('confirm-delete-button')
    expect(confirmButton).toBeDisabled()
  })

  it('enables confirm button when SUPPRIMER is typed', async () => {
    const user = userEvent.setup()
    render(<DeleteAccountDialog open={true} onOpenChange={mockOnOpenChange} />)

    const input = screen.getByTestId('confirmation-input')
    const confirmButton = screen.getByTestId('confirm-delete-button')

    expect(confirmButton).toBeDisabled()

    await user.type(input, 'SUPPRIMER')

    expect(confirmButton).not.toBeDisabled()
  })

  it('keeps confirm button disabled for incorrect input', async () => {
    const user = userEvent.setup()
    render(<DeleteAccountDialog open={true} onOpenChange={mockOnOpenChange} />)

    const input = screen.getByTestId('confirmation-input')
    const confirmButton = screen.getByTestId('confirm-delete-button')

    await user.type(input, 'supprimer') // lowercase
    expect(confirmButton).toBeDisabled()

    await user.clear(input)
    await user.type(input, 'SUPPRIME') // incomplete
    expect(confirmButton).toBeDisabled()

    await user.clear(input)
    await user.type(input, 'DELETE') // wrong word
    expect(confirmButton).toBeDisabled()
  })

  it('calls API and redirects on successful deletion', async () => {
    const user = userEvent.setup()
    render(<DeleteAccountDialog open={true} onOpenChange={mockOnOpenChange} />)

    const input = screen.getByTestId('confirmation-input')
    await user.type(input, 'SUPPRIMER')

    const confirmButton = screen.getByTestId('confirm-delete-button')
    await user.click(confirmButton)

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/account/delete', {
        method: 'DELETE',
      })
    })

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/login')
      expect(mockRefresh).toHaveBeenCalled()
    })
  })

  it('shows loading state during deletion', async () => {
    mockFetch.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      }), 100))
    )

    const user = userEvent.setup()
    render(<DeleteAccountDialog open={true} onOpenChange={mockOnOpenChange} />)

    const input = screen.getByTestId('confirmation-input')
    await user.type(input, 'SUPPRIMER')

    const confirmButton = screen.getByTestId('confirm-delete-button')
    await user.click(confirmButton)

    expect(screen.getByText('Suppression...')).toBeInTheDocument()
  })

  it('handles API error gracefully', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: { message: 'Server error' } }),
    })

    const { toast } = await import('sonner')
    const user = userEvent.setup()
    render(<DeleteAccountDialog open={true} onOpenChange={mockOnOpenChange} />)

    const input = screen.getByTestId('confirmation-input')
    await user.type(input, 'SUPPRIMER')

    const confirmButton = screen.getByTestId('confirm-delete-button')
    await user.click(confirmButton)

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Server error')
    })

    // Should not redirect on error
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('closes dialog and resets input when cancelled', async () => {
    const user = userEvent.setup()
    render(<DeleteAccountDialog open={true} onOpenChange={mockOnOpenChange} />)

    const input = screen.getByTestId('confirmation-input')
    await user.type(input, 'SUP')

    const cancelButton = screen.getByRole('button', { name: 'Annuler' })
    await user.click(cancelButton)

    expect(mockOnOpenChange).toHaveBeenCalledWith(false)
  })

  it('does not render when closed', () => {
    render(<DeleteAccountDialog open={false} onOpenChange={mockOnOpenChange} />)

    expect(screen.queryByText('Supprimer votre compte')).not.toBeInTheDocument()
  })
})
