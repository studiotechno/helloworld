import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ConversationItem } from './ConversationItem'
import type { Conversation } from '@/hooks/use-conversations'

// Mock next/navigation
const mockPush = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => '/chat/test-id',
}))

// Mock Tooltip to avoid RadixUI portal issues in tests
vi.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="tooltip-trigger">{children}</div>
  ),
  TooltipContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="tooltip-content">{children}</div>
  ),
}))

const mockConversation: Conversation = {
  id: 'test-id',
  user_id: 'user-1',
  repository_id: 'repo-1',
  title: 'My Conversation',
  created_at: '2026-01-10T10:00:00Z',
  updated_at: '2026-01-10T10:00:00Z',
  repository: { full_name: 'user/repo' },
  _count: { messages: 5 },
}

describe('ConversationItem', () => {
  const mockOnDeleteClick = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('expanded state', () => {
    it('renders conversation title', () => {
      render(
        <ConversationItem
          conversation={mockConversation}
          isCollapsed={false}
          onDeleteClick={mockOnDeleteClick}
        />
      )

      // Title appears in button and tooltip, use getAllByText
      const titles = screen.getAllByText('My Conversation')
      expect(titles.length).toBeGreaterThan(0)
    })

    it('renders "Sans titre" for null title', () => {
      const noTitleConversation = { ...mockConversation, title: null }
      render(
        <ConversationItem
          conversation={noTitleConversation}
          isCollapsed={false}
          onDeleteClick={mockOnDeleteClick}
        />
      )

      const titles = screen.getAllByText('Sans titre')
      expect(titles.length).toBeGreaterThan(0)
    })

    it('renders emoji based on title content', () => {
      const bugConversation = { ...mockConversation, title: 'Fix bug in login' }
      render(
        <ConversationItem
          conversation={bugConversation}
          isCollapsed={false}
          onDeleteClick={mockOnDeleteClick}
        />
      )

      expect(screen.getByText('🐛')).toBeInTheDocument()
    })

    it('navigates to conversation on click', () => {
      render(
        <ConversationItem
          conversation={mockConversation}
          isCollapsed={false}
          onDeleteClick={mockOnDeleteClick}
        />
      )

      // Find button by role, excluding the delete button
      const buttons = screen.getAllByRole('button')
      const mainButton = buttons.find(btn =>
        btn.textContent?.includes('My Conversation')
      )
      expect(mainButton).toBeDefined()
      fireEvent.click(mainButton!)

      expect(mockPush).toHaveBeenCalledWith('/chat/test-id')
    })

    it('shows delete button on hover', () => {
      render(
        <ConversationItem
          conversation={mockConversation}
          isCollapsed={false}
          onDeleteClick={mockOnDeleteClick}
        />
      )

      // Delete button should exist
      const deleteButton = screen.getByRole('button', {
        name: /supprimer la conversation/i,
      })
      expect(deleteButton).toBeInTheDocument()
    })

    it('calls onDeleteClick when delete button is clicked', () => {
      render(
        <ConversationItem
          conversation={mockConversation}
          isCollapsed={false}
          onDeleteClick={mockOnDeleteClick}
        />
      )

      const deleteButton = screen.getByRole('button', {
        name: /supprimer la conversation/i,
      })
      fireEvent.click(deleteButton)

      expect(mockOnDeleteClick).toHaveBeenCalledWith(mockConversation)
      // Should not navigate when clicking delete
      expect(mockPush).not.toHaveBeenCalled()
    })
  })

  describe('collapsed state', () => {
    it('renders emoji only in collapsed state', () => {
      render(
        <ConversationItem
          conversation={mockConversation}
          isCollapsed={true}
          onDeleteClick={mockOnDeleteClick}
        />
      )

      // Should have default emoji for "My Conversation"
      expect(screen.getByText('💬')).toBeInTheDocument()
      // Title should be in tooltip
      expect(screen.queryByText('My Conversation')).toBeInTheDocument()
    })

    it('navigates on click in collapsed state', () => {
      render(
        <ConversationItem
          conversation={mockConversation}
          isCollapsed={true}
          onDeleteClick={mockOnDeleteClick}
        />
      )

      const button = screen.getByRole('button')
      fireEvent.click(button)

      expect(mockPush).toHaveBeenCalledWith('/chat/test-id')
    })
  })
})
