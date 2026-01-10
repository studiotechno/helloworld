import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SuggestionChips } from './SuggestionChips'

const mockSuggestions = [
  { emoji: '🔧', text: 'First suggestion' },
  { emoji: '📁', text: 'Second suggestion' },
  { emoji: '🎯', text: 'Third suggestion' },
]

describe('SuggestionChips', () => {
  it('should render all suggestions', () => {
    render(<SuggestionChips suggestions={mockSuggestions} />)

    expect(screen.getByText('First suggestion')).toBeInTheDocument()
    expect(screen.getByText('Second suggestion')).toBeInTheDocument()
    expect(screen.getByText('Third suggestion')).toBeInTheDocument()
  })

  it('should render emojis', () => {
    render(<SuggestionChips suggestions={mockSuggestions} />)

    expect(screen.getByText('🔧')).toBeInTheDocument()
    expect(screen.getByText('📁')).toBeInTheDocument()
    expect(screen.getByText('🎯')).toBeInTheDocument()
  })

  it('should call onSelect when clicking a suggestion', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(<SuggestionChips suggestions={mockSuggestions} onSelect={onSelect} />)

    await user.click(screen.getByText('First suggestion'))

    expect(onSelect).toHaveBeenCalledWith('First suggestion')
  })

  it('should call onSelect with correct text for each suggestion', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(<SuggestionChips suggestions={mockSuggestions} onSelect={onSelect} />)

    await user.click(screen.getByText('Second suggestion'))
    expect(onSelect).toHaveBeenCalledWith('Second suggestion')

    await user.click(screen.getByText('Third suggestion'))
    expect(onSelect).toHaveBeenCalledWith('Third suggestion')
  })

  it('should apply custom className', () => {
    render(
      <SuggestionChips
        suggestions={mockSuggestions}
        className="custom-class"
      />
    )

    const container = screen.getByText('First suggestion').parentElement?.parentElement
    expect(container).toHaveClass('custom-class')
  })

  it('should render buttons with correct aria-label', () => {
    render(<SuggestionChips suggestions={mockSuggestions} />)

    expect(
      screen.getByRole('button', { name: /suggerer: first suggestion/i })
    ).toBeInTheDocument()
  })

  it('should work without onSelect handler', async () => {
    const user = userEvent.setup()
    render(<SuggestionChips suggestions={mockSuggestions} />)

    // Should not throw when clicking without handler
    await user.click(screen.getByText('First suggestion'))
  })

  it('should render empty when no suggestions', () => {
    const { container } = render(<SuggestionChips suggestions={[]} />)

    expect(container.querySelector('button')).not.toBeInTheDocument()
  })
})
