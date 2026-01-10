import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ScrollToBottom } from './ScrollToBottom'

describe('ScrollToBottom', () => {
  it('should not render when visible is false', () => {
    render(<ScrollToBottom onClick={vi.fn()} visible={false} />)

    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('should render when visible is true', () => {
    render(<ScrollToBottom onClick={vi.fn()} visible={true} />)

    expect(screen.getByRole('button')).toBeInTheDocument()
  })

  it('should display correct text', () => {
    render(<ScrollToBottom onClick={vi.fn()} visible={true} />)

    expect(screen.getByText('Retour en bas')).toBeInTheDocument()
  })

  it('should have accessible aria-label', () => {
    render(<ScrollToBottom onClick={vi.fn()} visible={true} />)

    expect(screen.getByRole('button')).toHaveAttribute(
      'aria-label',
      'Retour en bas'
    )
  })

  it('should call onClick when clicked', () => {
    const onClick = vi.fn()
    render(<ScrollToBottom onClick={onClick} visible={true} />)

    fireEvent.click(screen.getByRole('button'))

    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('should render arrow down icon', () => {
    const { container } = render(<ScrollToBottom onClick={vi.fn()} visible={true} />)

    expect(container.querySelector('svg')).toBeInTheDocument()
  })

  it('should apply custom className', () => {
    render(
      <ScrollToBottom onClick={vi.fn()} visible={true} className="custom-class" />
    )

    expect(screen.getByRole('button')).toHaveClass('custom-class')
  })
})
