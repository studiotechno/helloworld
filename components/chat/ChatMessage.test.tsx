import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ChatMessage } from './ChatMessage'

// Mock clipboard API
const mockWriteText = vi.fn().mockResolvedValue(undefined)

beforeEach(() => {
  vi.clearAllMocks()
  Object.defineProperty(navigator, 'clipboard', {
    value: {
      writeText: mockWriteText,
    },
    writable: true,
    configurable: true,
  })
})

describe('ChatMessage', () => {
  it('should render user message with correct styling', () => {
    render(<ChatMessage role="user" content="Hello world" />)

    expect(screen.getByText('Hello world')).toBeInTheDocument()
    expect(screen.getByRole('article')).toHaveAttribute(
      'aria-label',
      'Votre message'
    )
  })

  it('should render assistant message with correct styling', () => {
    render(<ChatMessage role="assistant" content="Hi there!" />)

    expect(screen.getByText('Hi there!')).toBeInTheDocument()
    expect(screen.getByRole('article')).toHaveAttribute(
      'aria-label',
      "Reponse de l'assistant"
    )
  })

  it('should render user avatar for user messages', () => {
    render(<ChatMessage role="user" content="Test" />)

    // User icon should be present
    const article = screen.getByRole('article')
    expect(article.querySelector('svg')).toBeInTheDocument()
  })

  it('should render sparkles avatar for assistant messages', () => {
    render(<ChatMessage role="assistant" content="Test" />)

    const article = screen.getByRole('article')
    expect(article.querySelector('svg')).toBeInTheDocument()
  })

  it('should render markdown content', () => {
    render(<ChatMessage role="assistant" content="**Bold** and *italic*" />)

    expect(screen.getByText('Bold')).toBeInTheDocument()
    expect(screen.getByText('and')).toBeInTheDocument()
    expect(screen.getByText('italic')).toBeInTheDocument()
  })

  it('should render code blocks in markdown', () => {
    render(<ChatMessage role="assistant" content="`code` here" />)

    expect(screen.getByText('code')).toBeInTheDocument()
  })

  it('should copy content to clipboard when copy button is clicked', async () => {
    render(<ChatMessage role="user" content="Copy this text" />)

    const copyButton = screen.getByRole('button', { name: /copier/i })
    fireEvent.click(copyButton)

    await waitFor(() => {
      expect(mockWriteText).toHaveBeenCalledWith('Copy this text')
    })
  })

  it('should show check icon after copying', async () => {
    render(<ChatMessage role="user" content="Copy this" />)

    const copyButton = screen.getByRole('button', { name: /copier/i })
    fireEvent.click(copyButton)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /copie/i })).toBeInTheDocument()
    })
  })

  it('should handle empty content gracefully', () => {
    render(<ChatMessage role="assistant" content="" />)

    // Should not crash
    expect(screen.getByRole('article')).toBeInTheDocument()
  })

  it('should show streaming indicator when isStreaming is true', () => {
    const { container } = render(
      <ChatMessage role="assistant" content="Streaming..." isStreaming />
    )

    // The streaming class adds a cursor animation
    const proseDiv = container.querySelector('.prose')
    expect(proseDiv).toHaveClass('after:animate-pulse')
  })
})
