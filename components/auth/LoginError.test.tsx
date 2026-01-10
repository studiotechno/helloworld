import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { LoginError } from './LoginError'

describe('LoginError', () => {
  beforeEach(() => {
    // Reset window.location mock
    Object.defineProperty(window, 'location', {
      value: { href: '' },
      writable: true,
    })
  })

  it('renders error message for access_denied', () => {
    render(<LoginError error="access_denied" />)

    expect(screen.getByText('Échec de la connexion')).toBeInTheDocument()
    expect(
      screen.getByText("Vous avez refusé l'accès à l'application GitHub.")
    ).toBeInTheDocument()
  })

  it('renders error message for server_error', () => {
    render(<LoginError error="server_error" />)

    expect(
      screen.getByText('Une erreur serveur est survenue. Veuillez réessayer.')
    ).toBeInTheDocument()
  })

  it('renders custom description when provided', () => {
    render(
      <LoginError error="unknown_error" description="Custom error message" />
    )

    expect(screen.getByText('Custom error message')).toBeInTheDocument()
  })

  it('renders default message for unknown error without description', () => {
    render(<LoginError error="unknown_error" />)

    expect(
      screen.getByText('Une erreur est survenue lors de la connexion.')
    ).toBeInTheDocument()
  })

  it('redirects to /login when retry button is clicked', () => {
    render(<LoginError error="access_denied" />)

    const retryButton = screen.getByRole('button', { name: /réessayer/i })
    fireEvent.click(retryButton)

    expect(window.location.href).toBe('/login')
  })

  it('displays retry button', () => {
    render(<LoginError error="server_error" />)

    expect(
      screen.getByRole('button', { name: /réessayer/i })
    ).toBeInTheDocument()
  })
})
