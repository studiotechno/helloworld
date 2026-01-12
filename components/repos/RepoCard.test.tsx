import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RepoCard } from './RepoCard'
import type { GitHubRepo } from '@/lib/github/types'
import type { ReactNode } from 'react'

// Mock fetch for indexing status
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

// Create wrapper with QueryClient
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    )
  }
}

const mockRepo: GitHubRepo = {
  id: 1,
  name: 'test-repo',
  full_name: 'user/test-repo',
  description: 'A test repository for testing',
  private: false,
  language: 'TypeScript',
  default_branch: 'main',
  updated_at: '2026-01-09T10:00:00Z',
  pushed_at: '2026-01-09T10:00:00Z',
  size: 1024,
  stargazers_count: 42,
}

describe('RepoCard', () => {
  it('should render repo full name', () => {
    render(<RepoCard repo={mockRepo} />, { wrapper: createWrapper() })
    expect(screen.getByText('user/test-repo')).toBeInTheDocument()
  })

  it('should render repo description', () => {
    render(<RepoCard repo={mockRepo} />, { wrapper: createWrapper() })
    expect(screen.getByText('A test repository for testing')).toBeInTheDocument()
  })

  it('should render language with colored badge', () => {
    render(<RepoCard repo={mockRepo} />, { wrapper: createWrapper() })
    expect(screen.getByText('TypeScript')).toBeInTheDocument()
  })

  it('should render star count when > 0', () => {
    render(<RepoCard repo={mockRepo} />, { wrapper: createWrapper() })
    expect(screen.getByText('42')).toBeInTheDocument()
  })

  it('should not render star count when 0', () => {
    const repoWithNoStars = { ...mockRepo, stargazers_count: 0 }
    render(<RepoCard repo={repoWithNoStars} />, { wrapper: createWrapper() })
    expect(screen.queryByText('0')).not.toBeInTheDocument()
  })

  it('should handle missing description', () => {
    const repoWithoutDescription = { ...mockRepo, description: null }
    render(<RepoCard repo={repoWithoutDescription} />, { wrapper: createWrapper() })
    expect(screen.getByText('user/test-repo')).toBeInTheDocument()
  })

  it('should handle missing language', () => {
    const repoWithoutLanguage = { ...mockRepo, language: null }
    render(<RepoCard repo={repoWithoutLanguage} />, { wrapper: createWrapper() })
    expect(screen.queryByText('TypeScript')).not.toBeInTheDocument()
  })

  it('should show "Privé" badge for private repos', () => {
    const privateRepo = { ...mockRepo, private: true }
    render(<RepoCard repo={privateRepo} />, { wrapper: createWrapper() })
    expect(screen.getByText('Privé')).toBeInTheDocument()
  })

  it('should not show "Privé" badge for public repos', () => {
    render(<RepoCard repo={mockRepo} />, { wrapper: createWrapper() })
    expect(screen.queryByText('Privé')).not.toBeInTheDocument()
  })

  it('should call onClick when clicked', () => {
    const handleClick = vi.fn()
    render(<RepoCard repo={mockRepo} onClick={handleClick} />, { wrapper: createWrapper() })

    fireEvent.click(screen.getByRole('button'))
    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it('should render relative time for pushed_at', () => {
    // The exact text depends on the current time, so we just check it renders something
    render(<RepoCard repo={mockRepo} />, { wrapper: createWrapper() })
    // Should contain some time-related text
    const button = screen.getByRole('button')
    expect(button.textContent).toMatch(/il y a/)
  })
})
