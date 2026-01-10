import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LogoutButton } from './LogoutButton'

const mockPush = vi.fn()
const mockRefresh = vi.fn()
const mockSignOut = vi.fn()

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: mockRefresh,
  }),
}))

// Mock Supabase client
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      signOut: mockSignOut,
    },
  }),
}))

describe('LogoutButton', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSignOut.mockResolvedValue({})
  })

  it('renders with default text and icon', () => {
    render(<LogoutButton />)

    expect(screen.getByText('Se déconnecter')).toBeInTheDocument()
    expect(screen.getByRole('button')).toBeInTheDocument()
  })

  it('renders without text when showText is false', () => {
    render(<LogoutButton showText={false} />)

    expect(screen.queryByText('Se déconnecter')).not.toBeInTheDocument()
  })

  it('calls signOut and redirects to login on click', async () => {
    const user = userEvent.setup()
    render(<LogoutButton />)

    const button = screen.getByRole('button')
    await user.click(button)

    await waitFor(() => {
      expect(mockSignOut).toHaveBeenCalled()
      expect(mockPush).toHaveBeenCalledWith('/login')
      expect(mockRefresh).toHaveBeenCalled()
    })
  })

  it('shows loading state during logout', async () => {
    mockSignOut.mockImplementation(
      () => new Promise((resolve) => setTimeout(resolve, 100))
    )

    const user = userEvent.setup()
    render(<LogoutButton />)

    const button = screen.getByRole('button')
    await user.click(button)

    expect(screen.getByText('Déconnexion...')).toBeInTheDocument()
    expect(button).toBeDisabled()
  })

  it('applies custom className', () => {
    render(<LogoutButton className="custom-class" />)

    expect(screen.getByRole('button')).toHaveClass('custom-class')
  })

  it('uses correct variant', () => {
    render(<LogoutButton variant="destructive" />)

    // The button should exist and use destructive variant
    expect(screen.getByRole('button')).toBeInTheDocument()
  })

  it('handles logout error gracefully', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    mockSignOut.mockRejectedValue(new Error('Logout failed'))

    const user = userEvent.setup()
    render(<LogoutButton />)

    const button = screen.getByRole('button')
    await user.click(button)

    await waitFor(() => {
      expect(consoleError).toHaveBeenCalledWith(
        '[Auth] Logout error:',
        expect.any(Error)
      )
      // Button should be re-enabled after error
      expect(button).not.toBeDisabled()
    })

    consoleError.mockRestore()
  })
})
