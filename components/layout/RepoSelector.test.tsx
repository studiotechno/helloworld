import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { RepoSelector } from './RepoSelector'
import type { ConnectedRepository } from '@/hooks/useConnectRepo'

// Mock next/navigation
const mockPush = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}))

describe('RepoSelector', () => {
  const mockRepo: ConnectedRepository = {
    id: 'repo-123',
    user_id: 'user-456',
    github_repo_id: '789',
    full_name: 'owner/my-repo',
    default_branch: 'main',
    is_active: true,
    last_synced_at: null,
    created_at: '2024-01-01T00:00:00Z',
  }

  beforeEach(() => {
    mockPush.mockClear()
  })

  describe('Loading State', () => {
    it('should render skeleton when loading', () => {
      render(<RepoSelector repo={null} isLoading={true} />)

      // Skeleton has a specific class
      const skeleton = document.querySelector('[class*="animate-pulse"]')
      expect(skeleton).toBeInTheDocument()
    })
  })

  describe('No Repo Connected', () => {
    it('should render connect button when no repo', () => {
      render(<RepoSelector repo={null} isLoading={false} />)

      expect(screen.getByText('Selectionnez un repository')).toBeInTheDocument()
    })

    it('should navigate to /repos when clicking connect button', () => {
      render(<RepoSelector repo={null} isLoading={false} />)

      const button = screen.getByRole('button')
      fireEvent.click(button)

      expect(mockPush).toHaveBeenCalledWith('/repos')
    })
  })

  describe('Repo Connected', () => {
    it('should display repo full name', () => {
      render(<RepoSelector repo={mockRepo} isLoading={false} />)

      expect(screen.getByText('owner/my-repo')).toBeInTheDocument()
    })

    it('should display default branch', () => {
      render(<RepoSelector repo={mockRepo} isLoading={false} />)

      expect(screen.getByText('main')).toBeInTheDocument()
    })

    it('should have accessible label for repo button', () => {
      render(<RepoSelector repo={mockRepo} isLoading={false} />)

      const button = screen.getByRole('button', { name: /repository actif.*owner\/my-repo/i })
      expect(button).toBeInTheDocument()
    })

    it('should have dropdown trigger with proper aria attributes', () => {
      render(<RepoSelector repo={mockRepo} isLoading={false} />)

      const trigger = screen.getByRole('button', { name: /repository actif/i })
      // Radix UI dropdown adds these aria attributes
      expect(trigger).toHaveAttribute('aria-haspopup', 'menu')
      expect(trigger).toHaveAttribute('data-state')
    })
  })

  describe('Custom className', () => {
    it('should accept custom className', () => {
      render(<RepoSelector repo={mockRepo} className="custom-class" />)

      const button = screen.getByRole('button', { name: /repository actif/i })
      expect(button).toHaveClass('custom-class')
    })
  })
})
