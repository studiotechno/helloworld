import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { LoginButton } from './LoginButton'

// Mock Supabase client
const mockSignInWithOAuth = vi.fn()

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      signInWithOAuth: mockSignInWithOAuth,
    },
  }),
}))

describe('LoginButton', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSignInWithOAuth.mockResolvedValue({ error: null })
  })

  it('renders correctly with GitHub icon and text', () => {
    render(<LoginButton />)

    expect(screen.getByRole('button')).toBeInTheDocument()
    expect(screen.getByText('Se connecter avec GitHub')).toBeInTheDocument()
  })

  it('calls signInWithOAuth with github provider on click', async () => {
    render(<LoginButton />)

    const button = screen.getByRole('button')
    fireEvent.click(button)

    await waitFor(() => {
      expect(mockSignInWithOAuth).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: 'github',
          options: expect.objectContaining({
            scopes: 'repo user:email',
          }),
        })
      )
    })
  })

  it('shows loading state when clicked', async () => {
    // Make the OAuth call hang
    mockSignInWithOAuth.mockImplementation(() => new Promise(() => {}))

    render(<LoginButton />)

    const button = screen.getByRole('button')
    fireEvent.click(button)

    await waitFor(() => {
      expect(screen.getByText('Connexion...')).toBeInTheDocument()
      expect(button).toBeDisabled()
    })
  })

  it('passes redirectTo parameter to callback URL', async () => {
    render(<LoginButton redirectTo="/settings" />)

    const button = screen.getByRole('button')
    fireEvent.click(button)

    await waitFor(() => {
      expect(mockSignInWithOAuth).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({
            redirectTo: expect.stringContaining('redirectTo=%2Fsettings'),
          }),
        })
      )
    })
  })

  it('resets loading state on OAuth error', async () => {
    mockSignInWithOAuth.mockResolvedValue({ error: new Error('OAuth failed') })

    render(<LoginButton />)

    const button = screen.getByRole('button')
    fireEvent.click(button)

    await waitFor(() => {
      expect(screen.getByText('Se connecter avec GitHub')).toBeInTheDocument()
      expect(button).not.toBeDisabled()
    })
  })
})
