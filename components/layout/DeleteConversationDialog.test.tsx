import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { DeleteConversationDialog } from './DeleteConversationDialog'

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

import { toast } from 'sonner'

describe('DeleteConversationDialog', () => {
  const mockOnOpenChange = vi.fn()
  const mockOnDelete = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    mockOnDelete.mockResolvedValue(undefined)
  })

  it('renders dialog when open', () => {
    render(
      <DeleteConversationDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        conversationTitle="Test Conversation"
        onDelete={mockOnDelete}
      />
    )

    expect(screen.getByText('Supprimer cette conversation ?')).toBeInTheDocument()
    expect(screen.getByText('Test Conversation')).toBeInTheDocument()
  })

  it('does not render when closed', () => {
    render(
      <DeleteConversationDialog
        open={false}
        onOpenChange={mockOnOpenChange}
        conversationTitle="Test Conversation"
        onDelete={mockOnDelete}
      />
    )

    expect(screen.queryByText('Supprimer cette conversation ?')).not.toBeInTheDocument()
  })

  it('shows irreversible action warning', () => {
    render(
      <DeleteConversationDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        conversationTitle="Test Conversation"
        onDelete={mockOnDelete}
      />
    )

    expect(
      screen.getByText(/cette action est irreversible/i)
    ).toBeInTheDocument()
  })

  it('calls onDelete when confirm button is clicked', async () => {
    render(
      <DeleteConversationDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        conversationTitle="Test Conversation"
        onDelete={mockOnDelete}
      />
    )

    const deleteButton = screen.getByRole('button', { name: /supprimer/i })
    fireEvent.click(deleteButton)

    await waitFor(() => {
      expect(mockOnDelete).toHaveBeenCalled()
    })
  })

  it('shows success toast on successful delete', async () => {
    render(
      <DeleteConversationDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        conversationTitle="Test Conversation"
        onDelete={mockOnDelete}
      />
    )

    const deleteButton = screen.getByRole('button', { name: /supprimer/i })
    fireEvent.click(deleteButton)

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Conversation supprimee')
    })
  })

  it('closes dialog on successful delete', async () => {
    render(
      <DeleteConversationDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        conversationTitle="Test Conversation"
        onDelete={mockOnDelete}
      />
    )

    const deleteButton = screen.getByRole('button', { name: /supprimer/i })
    fireEvent.click(deleteButton)

    await waitFor(() => {
      expect(mockOnOpenChange).toHaveBeenCalledWith(false)
    })
  })

  it('shows error toast on delete failure', async () => {
    mockOnDelete.mockRejectedValue(new Error('Delete failed'))

    render(
      <DeleteConversationDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        conversationTitle="Test Conversation"
        onDelete={mockOnDelete}
      />
    )

    const deleteButton = screen.getByRole('button', { name: /supprimer/i })
    fireEvent.click(deleteButton)

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Delete failed')
    })
  })

  it('shows loading state during deletion', async () => {
    mockOnDelete.mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 100)))

    render(
      <DeleteConversationDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        conversationTitle="Test Conversation"
        onDelete={mockOnDelete}
      />
    )

    const deleteButton = screen.getByRole('button', { name: /supprimer/i })
    fireEvent.click(deleteButton)

    // Should show loading text
    expect(await screen.findByText('Suppression...')).toBeInTheDocument()
  })

  it('disables cancel button during deletion', async () => {
    mockOnDelete.mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 100)))

    render(
      <DeleteConversationDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        conversationTitle="Test Conversation"
        onDelete={mockOnDelete}
      />
    )

    const deleteButton = screen.getByRole('button', { name: /supprimer/i })
    fireEvent.click(deleteButton)

    await waitFor(() => {
      const cancelButton = screen.getByRole('button', { name: /annuler/i })
      expect(cancelButton).toBeDisabled()
    })
  })

  it('calls onOpenChange with false when cancel is clicked', () => {
    render(
      <DeleteConversationDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        conversationTitle="Test Conversation"
        onDelete={mockOnDelete}
      />
    )

    const cancelButton = screen.getByRole('button', { name: /annuler/i })
    fireEvent.click(cancelButton)

    expect(mockOnOpenChange).toHaveBeenCalledWith(false)
  })
})
