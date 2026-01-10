import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ChatContainer } from './ChatContainer'

describe('ChatContainer', () => {
  it('should render children', () => {
    render(
      <ChatContainer>
        <div data-testid="child">Test content</div>
      </ChatContainer>
    )

    expect(screen.getByTestId('child')).toBeInTheDocument()
    expect(screen.getByText('Test content')).toBeInTheDocument()
  })

  it('should apply max-width class', () => {
    render(
      <ChatContainer>
        <div>Content</div>
      </ChatContainer>
    )

    const container = screen.getByText('Content').parentElement
    expect(container).toHaveClass('max-w-[800px]')
  })

  it('should apply custom className', () => {
    render(
      <ChatContainer className="custom-class">
        <div>Content</div>
      </ChatContainer>
    )

    const container = screen.getByText('Content').parentElement
    expect(container).toHaveClass('custom-class')
  })

  it('should have flex column layout', () => {
    render(
      <ChatContainer>
        <div>Content</div>
      </ChatContainer>
    )

    const container = screen.getByText('Content').parentElement
    expect(container).toHaveClass('flex')
    expect(container).toHaveClass('flex-col')
  })
})
