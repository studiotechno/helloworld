import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Sidebar } from './Sidebar'

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
  usePathname: () => '/chat',
}))

// Mock useConversations hook
vi.mock('@/hooks', () => ({
  useConversations: () => ({
    data: [],
    isLoading: false,
  }),
}))

// Mock TooltipProvider context
vi.mock('@/components/ui/tooltip', async () => {
  const actual = await vi.importActual('@/components/ui/tooltip')
  return {
    ...actual,
    TooltipProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    TooltipTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    TooltipContent: ({ children }: { children: React.ReactNode }) => <div data-testid="tooltip-content">{children}</div>,
  }
})

describe('Sidebar', () => {
  const mockOnToggle = vi.fn()

  beforeEach(() => {
    mockOnToggle.mockClear()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('renders expanded sidebar with branding', () => {
    render(<Sidebar isCollapsed={false} onToggle={mockOnToggle} />)

    expect(screen.getByText('techno')).toBeInTheDocument()
    expect(screen.getByText('Nouvelle conversation')).toBeInTheDocument()
    expect(screen.getByText('Conversations')).toBeInTheDocument()
  })

  it('renders collapsed sidebar without visible text (text in tooltips only)', () => {
    render(<Sidebar isCollapsed={true} onToggle={mockOnToggle} />)

    // Branding text should not be visible
    expect(screen.queryByText('techno')).not.toBeInTheDocument()
    // Conversations label should not be visible
    expect(screen.queryByText('Conversations')).not.toBeInTheDocument()
    // Keyboard hint should not be visible
    expect(screen.queryByText('pour réduire')).not.toBeInTheDocument()
  })

  it('calls onToggle when toggle button is clicked', () => {
    render(<Sidebar isCollapsed={false} onToggle={mockOnToggle} />)

    const toggleButton = screen.getByRole('button', { name: /réduire la sidebar/i })
    fireEvent.click(toggleButton)

    expect(mockOnToggle).toHaveBeenCalledTimes(1)
  })

  it('shows correct aria-label for collapsed state', () => {
    render(<Sidebar isCollapsed={true} onToggle={mockOnToggle} />)

    expect(screen.getByRole('button', { name: /développer la sidebar/i })).toBeInTheDocument()
  })

  it('has navigation role for accessibility', () => {
    render(<Sidebar isCollapsed={false} onToggle={mockOnToggle} />)

    expect(screen.getByRole('navigation')).toBeInTheDocument()
  })

  it('responds to ⌘+B keyboard shortcut', () => {
    render(<Sidebar isCollapsed={false} onToggle={mockOnToggle} />)

    fireEvent.keyDown(document, { key: 'b', metaKey: true })

    expect(mockOnToggle).toHaveBeenCalledTimes(1)
  })

  it('responds to Ctrl+B keyboard shortcut (Windows)', () => {
    render(<Sidebar isCollapsed={false} onToggle={mockOnToggle} />)

    fireEvent.keyDown(document, { key: 'b', ctrlKey: true })

    expect(mockOnToggle).toHaveBeenCalledTimes(1)
  })

  it('does not trigger toggle on regular B keypress', () => {
    render(<Sidebar isCollapsed={false} onToggle={mockOnToggle} />)

    fireEvent.keyDown(document, { key: 'b' })

    expect(mockOnToggle).not.toHaveBeenCalled()
  })

  it('shows keyboard hint in footer when expanded', () => {
    render(<Sidebar isCollapsed={false} onToggle={mockOnToggle} />)

    expect(screen.getByText('pour réduire')).toBeInTheDocument()
    expect(screen.getByText('⌘+B')).toBeInTheDocument()
  })

  it('hides keyboard hint when collapsed', () => {
    render(<Sidebar isCollapsed={true} onToggle={mockOnToggle} />)

    expect(screen.queryByText('pour réduire')).not.toBeInTheDocument()
  })
})
