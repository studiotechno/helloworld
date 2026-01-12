import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TopBar } from './TopBar'
import type { ReactNode } from 'react'

// Mock fetch for indexing status (used by RepoSelector)
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}))

// Mock Supabase client
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      signOut: vi.fn().mockResolvedValue({}),
    },
  }),
}))

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

describe('TopBar', () => {
  const mockUser = {
    name: 'Test User',
    email: 'test@example.com',
    avatarUrl: 'https://example.com/avatar.jpg',
  }

  const mockRepo = {
    id: 'repo-123',
    user_id: 'user-456',
    github_repo_id: '789',
    full_name: 'owner/my-repo',
    default_branch: 'main',
    is_active: true,
    last_synced_at: null,
    created_at: '2024-01-01T00:00:00Z',
  }

  it('renders user information', () => {
    render(<TopBar user={mockUser} />, { wrapper: createWrapper() })

    expect(screen.getByText('Test User')).toBeInTheDocument()
  })

  it('renders RepoSelector with no repo connected state', () => {
    render(<TopBar user={mockUser} repo={null} />, { wrapper: createWrapper() })

    expect(screen.getByText('Selectionnez un repository')).toBeInTheDocument()
  })

  it('renders RepoSelector with connected repo', () => {
    render(<TopBar user={mockUser} repo={mockRepo} />, { wrapper: createWrapper() })

    expect(screen.getByText('owner/my-repo')).toBeInTheDocument()
    expect(screen.getByText('main')).toBeInTheDocument()
  })

  it('renders TechTags when technologies are provided', () => {
    render(<TopBar user={mockUser} repo={mockRepo} technologies={['TypeScript', 'Python']} />, { wrapper: createWrapper() })

    expect(screen.getByText('TypeScript')).toBeInTheDocument()
    expect(screen.getByText('Python')).toBeInTheDocument()
  })

  it('does not render TechTags when technologies are empty', () => {
    render(<TopBar user={mockUser} repo={mockRepo} technologies={[]} />, { wrapper: createWrapper() })

    // TechTags should not render anything for empty array
    expect(screen.queryByText('TypeScript')).not.toBeInTheDocument()
  })

  it('shows menu button when showMenuButton is true', () => {
    const mockOnMenuClick = vi.fn()
    render(
      <TopBar
        user={mockUser}
        showMenuButton={true}
        onMenuClick={mockOnMenuClick}
      />,
      { wrapper: createWrapper() }
    )

    const menuButton = screen.getByRole('button', { name: /ouvrir le menu/i })
    expect(menuButton).toBeInTheDocument()
  })

  it('calls onMenuClick when menu button is clicked', () => {
    const mockOnMenuClick = vi.fn()
    render(
      <TopBar
        user={mockUser}
        showMenuButton={true}
        onMenuClick={mockOnMenuClick}
      />,
      { wrapper: createWrapper() }
    )

    const menuButton = screen.getByRole('button', { name: /ouvrir le menu/i })
    fireEvent.click(menuButton)

    expect(mockOnMenuClick).toHaveBeenCalledTimes(1)
  })

  it('does not show menu button when showMenuButton is false', () => {
    render(<TopBar user={mockUser} showMenuButton={false} />, { wrapper: createWrapper() })

    expect(screen.queryByRole('button', { name: /ouvrir le menu/i })).not.toBeInTheDocument()
  })

  it('renders header with sticky positioning', () => {
    const { container } = render(<TopBar user={mockUser} />, { wrapper: createWrapper() })

    const header = container.querySelector('header')
    expect(header).toHaveClass('sticky')
    expect(header).toHaveClass('top-0')
  })
})
