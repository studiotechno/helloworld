import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { UserMenu } from './UserMenu'

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

describe('UserMenu', () => {
  const mockUser = {
    name: 'Test User',
    email: 'test@example.com',
    avatarUrl: 'https://example.com/avatar.jpg',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockSignOut.mockResolvedValue({})
  })

  it('renders user avatar and name', () => {
    render(<UserMenu user={mockUser} />)

    expect(screen.getByRole('button', { name: /menu utilisateur/i })).toBeInTheDocument()
    expect(screen.getByText('Test User')).toBeInTheDocument()
  })

  it('shows user initials as fallback', () => {
    const userWithoutAvatar = { ...mockUser, avatarUrl: null }
    render(<UserMenu user={userWithoutAvatar} />)

    expect(screen.getByText('TU')).toBeInTheDocument()
  })

  it('opens dropdown menu on click', async () => {
    const user = userEvent.setup()
    render(<UserMenu user={mockUser} />)

    const trigger = screen.getByRole('button', { name: /menu utilisateur/i })
    await user.click(trigger)

    await waitFor(() => {
      expect(screen.getByText('Paramètres')).toBeInTheDocument()
      expect(screen.getByText('Se déconnecter')).toBeInTheDocument()
    })
  })

  it('displays user email in dropdown', async () => {
    const user = userEvent.setup()
    render(<UserMenu user={mockUser} />)

    const trigger = screen.getByRole('button', { name: /menu utilisateur/i })
    await user.click(trigger)

    await waitFor(() => {
      expect(screen.getByText('test@example.com')).toBeInTheDocument()
    })
  })

  it('navigates to settings when Paramètres is clicked', async () => {
    const user = userEvent.setup()
    render(<UserMenu user={mockUser} />)

    const trigger = screen.getByRole('button', { name: /menu utilisateur/i })
    await user.click(trigger)

    await waitFor(() => {
      expect(screen.getByText('Paramètres')).toBeInTheDocument()
    })

    const settingsItem = screen.getByText('Paramètres')
    await user.click(settingsItem)

    expect(mockPush).toHaveBeenCalledWith('/settings')
  })

  it('calls signOut and redirects on logout', async () => {
    const user = userEvent.setup()
    render(<UserMenu user={mockUser} />)

    const trigger = screen.getByRole('button', { name: /menu utilisateur/i })
    await user.click(trigger)

    await waitFor(() => {
      expect(screen.getByText('Se déconnecter')).toBeInTheDocument()
    })

    const logoutItem = screen.getByText('Se déconnecter')
    await user.click(logoutItem)

    await waitFor(() => {
      expect(mockSignOut).toHaveBeenCalled()
      expect(mockPush).toHaveBeenCalledWith('/login')
      expect(mockRefresh).toHaveBeenCalled()
    })
  })

  it('handles user without email gracefully', async () => {
    const user = userEvent.setup()
    const userWithoutEmail = { name: 'Test', email: null, avatarUrl: null }
    render(<UserMenu user={userWithoutEmail} />)

    const trigger = screen.getByRole('button', { name: /menu utilisateur/i })
    await user.click(trigger)

    await waitFor(() => {
      // Should show name but not email
      const names = screen.getAllByText('Test')
      expect(names.length).toBeGreaterThan(0)
    })
  })
})
