import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TechTags } from './TechTags'

describe('TechTags', () => {
  it('should render nothing when technologies array is empty', () => {
    const { container } = render(<TechTags technologies={[]} />)
    expect(container.firstChild).toBeNull()
  })

  it('should render nothing when technologies is undefined', () => {
    const { container } = render(<TechTags technologies={undefined as unknown as string[]} />)
    expect(container.firstChild).toBeNull()
  })

  it('should render a single technology', () => {
    render(<TechTags technologies={['TypeScript']} />)
    expect(screen.getByText('TypeScript')).toBeInTheDocument()
  })

  it('should render multiple technologies up to maxVisible', () => {
    render(<TechTags technologies={['TypeScript', 'Python', 'Go']} maxVisible={3} />)

    expect(screen.getByText('TypeScript')).toBeInTheDocument()
    expect(screen.getByText('Python')).toBeInTheDocument()
    expect(screen.getByText('Go')).toBeInTheDocument()
  })

  it('should show +N for hidden technologies when exceeding maxVisible', () => {
    render(
      <TechTags
        technologies={['TypeScript', 'Python', 'Go', 'Rust', 'Java']}
        maxVisible={3}
      />
    )

    expect(screen.getByText('TypeScript')).toBeInTheDocument()
    expect(screen.getByText('Python')).toBeInTheDocument()
    expect(screen.getByText('Go')).toBeInTheDocument()
    expect(screen.getByText('+2')).toBeInTheDocument()
    expect(screen.queryByText('Rust')).not.toBeInTheDocument()
    expect(screen.queryByText('Java')).not.toBeInTheDocument()
  })

  it('should apply correct color classes for known technologies', () => {
    render(<TechTags technologies={['TypeScript', 'Python', 'React']} maxVisible={3} />)

    const tsTag = screen.getByText('TypeScript')
    const pyTag = screen.getByText('Python')
    const reactTag = screen.getByText('React')

    // TypeScript should have blue color
    expect(tsTag).toHaveClass('text-blue-400')
    // Python should have green color
    expect(pyTag).toHaveClass('text-green-400')
    // React should have cyan color
    expect(reactTag).toHaveClass('text-cyan-400')
  })

  it('should apply default color for unknown technologies', () => {
    render(<TechTags technologies={['UnknownLang']} />)

    const tag = screen.getByText('UnknownLang')
    expect(tag).toHaveClass('text-gray-400')
  })

  it('should accept custom className', () => {
    const { container } = render(
      <TechTags technologies={['TypeScript']} className="custom-class" />
    )

    expect(container.firstChild).toHaveClass('custom-class')
  })

  it('should default maxVisible to 3', () => {
    render(
      <TechTags technologies={['TypeScript', 'Python', 'Go', 'Rust', 'Java']} />
    )

    expect(screen.getByText('TypeScript')).toBeInTheDocument()
    expect(screen.getByText('Python')).toBeInTheDocument()
    expect(screen.getByText('Go')).toBeInTheDocument()
    expect(screen.getByText('+2')).toBeInTheDocument()
  })
})
