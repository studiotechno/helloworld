import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TypingIndicator } from './TypingIndicator'

describe('TypingIndicator', () => {
  it('should render with status role', () => {
    render(<TypingIndicator />)

    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('should have accessible aria-label', () => {
    render(<TypingIndicator />)

    expect(screen.getByRole('status')).toHaveAttribute(
      'aria-label',
      "L'assistant est en train d'ecrire"
    )
  })

  it('should render three bouncing dots', () => {
    const { container } = render(<TypingIndicator />)

    const dots = container.querySelectorAll('.animate-bounce')
    expect(dots).toHaveLength(3)
  })

  it('should render avatar with sparkles icon', () => {
    const { container } = render(<TypingIndicator />)

    expect(container.querySelector('svg')).toBeInTheDocument()
  })

  it('should apply custom className', () => {
    const { container } = render(<TypingIndicator className="custom-class" />)

    expect(container.firstChild).toHaveClass('custom-class')
  })

  it('should have staggered animation delays on dots', () => {
    const { container } = render(<TypingIndicator />)

    const dots = container.querySelectorAll('.animate-bounce')

    // First dot has -0.3s delay
    expect(dots[0]).toHaveStyle({ animationDelay: '-0.3s' })
    // Second dot has -0.15s delay
    expect(dots[1]).toHaveStyle({ animationDelay: '-0.15s' })
    // Third dot has no delay (default)
  })
})
