import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SizeWarningDialog } from './SizeWarningDialog'

describe('SizeWarningDialog', () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    repoName: 'owner/large-repo',
    sizeKB: 60000, // 60MB
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
    isLoading: false,
  }

  it('should render the dialog when open', () => {
    render(<SizeWarningDialog {...defaultProps} />)

    expect(screen.getByText('Repository volumineux')).toBeInTheDocument()
    expect(screen.getByText('owner/large-repo')).toBeInTheDocument()
  })

  it('should display repository size information', () => {
    render(<SizeWarningDialog {...defaultProps} />)

    expect(screen.getByText('60000 KB')).toBeInTheDocument()
    expect(screen.getByText('50000 KB')).toBeInTheDocument() // Threshold (50MB)
  })

  it('should call onConfirm when clicking continue button', () => {
    render(<SizeWarningDialog {...defaultProps} />)

    const confirmButton = screen.getByRole('button', { name: /continuer/i })
    fireEvent.click(confirmButton)

    expect(defaultProps.onConfirm).toHaveBeenCalledTimes(1)
  })

  it('should call onCancel when clicking cancel button', () => {
    render(<SizeWarningDialog {...defaultProps} />)

    const cancelButton = screen.getByRole('button', { name: /annuler/i })
    fireEvent.click(cancelButton)

    expect(defaultProps.onCancel).toHaveBeenCalledTimes(1)
  })

  it('should show loading state when isLoading is true', () => {
    render(<SizeWarningDialog {...defaultProps} isLoading={true} />)

    expect(screen.getByText('Connexion...')).toBeInTheDocument()
  })

  it('should disable buttons when loading', () => {
    render(<SizeWarningDialog {...defaultProps} isLoading={true} />)

    const confirmButton = screen.getByRole('button', { name: /connexion/i })
    const cancelButton = screen.getByRole('button', { name: /annuler/i })

    expect(confirmButton).toBeDisabled()
    expect(cancelButton).toBeDisabled()
  })

  it('should not render when closed', () => {
    render(<SizeWarningDialog {...defaultProps} open={false} />)

    expect(screen.queryByText('Repository volumineux')).not.toBeInTheDocument()
  })
})
