import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { DisconnectRepoDialog } from './DisconnectRepoDialog'

// Mock next/navigation
const mockPush = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}))

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

describe('DisconnectRepoDialog', () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    repoName: 'owner/my-repo',
    onDisconnect: vi.fn().mockResolvedValue({ success: true }),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render the dialog when open', () => {
    render(<DisconnectRepoDialog {...defaultProps} />)

    expect(screen.getByText('Déconnecter le repository ?')).toBeInTheDocument()
    expect(screen.getByText('owner/my-repo')).toBeInTheDocument()
  })

  it('should display repository name in description', () => {
    render(<DisconnectRepoDialog {...defaultProps} />)

    expect(screen.getByText(/owner\/my-repo/)).toBeInTheDocument()
    expect(screen.getByText(/Vos conversations passees resteront accessibles/)).toBeInTheDocument()
  })

  it('should call onDisconnect when clicking disconnect button', async () => {
    render(<DisconnectRepoDialog {...defaultProps} />)

    const disconnectButton = screen.getByRole('button', { name: /déconnecter/i })
    fireEvent.click(disconnectButton)

    await waitFor(() => {
      expect(defaultProps.onDisconnect).toHaveBeenCalledTimes(1)
    })
  })

  it('should call onOpenChange with false when clicking cancel', () => {
    render(<DisconnectRepoDialog {...defaultProps} />)

    const cancelButton = screen.getByRole('button', { name: /annuler/i })
    fireEvent.click(cancelButton)

    expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false)
  })

  it('should show loading state during disconnect', async () => {
    const slowDisconnect = vi.fn().mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve({ success: true }), 100))
    )

    render(<DisconnectRepoDialog {...defaultProps} onDisconnect={slowDisconnect} />)

    const disconnectButton = screen.getByRole('button', { name: /déconnecter/i })
    fireEvent.click(disconnectButton)

    expect(screen.getByText('Déconnexion...')).toBeInTheDocument()
  })

  it('should navigate to /repos on successful disconnect', async () => {
    render(<DisconnectRepoDialog {...defaultProps} />)

    const disconnectButton = screen.getByRole('button', { name: /déconnecter/i })
    fireEvent.click(disconnectButton)

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/repos')
    })
  })

  it('should not render when closed', () => {
    render(<DisconnectRepoDialog {...defaultProps} open={false} />)

    expect(screen.queryByText('Déconnecter le repository ?')).not.toBeInTheDocument()
  })
})
