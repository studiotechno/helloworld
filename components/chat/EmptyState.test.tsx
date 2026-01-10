import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { EmptyState } from './EmptyState'

describe('EmptyState', () => {
  it('should render title with gradient', () => {
    render(<EmptyState />)

    const title = screen.getByRole('heading', { level: 2 })
    expect(title).toHaveTextContent('Posez votre premiere question')
    expect(title).toHaveClass('bg-gradient-to-r')
    expect(title).toHaveClass('bg-clip-text')
  })

  it('should render description', () => {
    render(<EmptyState />)

    expect(
      screen.getByText(/Interrogez votre codebase en langage naturel/)
    ).toBeInTheDocument()
  })

  it('should render icon with glow effect', () => {
    render(<EmptyState />)

    // The icon is inside a container with animate-pulse for the glow
    const glowElement = document.querySelector('.animate-pulse')
    expect(glowElement).toBeInTheDocument()
  })

  it('should render suggestion chips', () => {
    render(<EmptyState />)

    expect(screen.getByText("C'est quoi la stack technique?")).toBeInTheDocument()
    expect(screen.getByText('Quelles sont les features principales?')).toBeInTheDocument()
    expect(screen.getByText('Montre-moi le schema de la BDD')).toBeInTheDocument()
    expect(screen.getByText('Comment est structure le projet?')).toBeInTheDocument()
  })

  it('should call onSuggestionClick when clicking a suggestion', async () => {
    const user = userEvent.setup()
    const onSuggestionClick = vi.fn()
    render(<EmptyState onSuggestionClick={onSuggestionClick} />)

    const suggestion = screen.getByText("C'est quoi la stack technique?")
    await user.click(suggestion)

    expect(onSuggestionClick).toHaveBeenCalledWith("C'est quoi la stack technique?")
  })

  it('should render emojis for suggestions', () => {
    render(<EmptyState />)

    // Check for emojis in the document
    expect(screen.getByText('🔧')).toBeInTheDocument()
    expect(screen.getByText('🎯')).toBeInTheDocument()
    expect(screen.getByText('🗄️')).toBeInTheDocument()
    expect(screen.getByText('📁')).toBeInTheDocument()
  })
})
