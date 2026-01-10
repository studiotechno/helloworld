import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ChatInput } from './ChatInput'

describe('ChatInput', () => {
  const defaultProps = {
    value: '',
    onChange: vi.fn(),
    onSend: vi.fn(),
  }

  it('should render with placeholder', () => {
    render(<ChatInput {...defaultProps} />)

    expect(
      screen.getByPlaceholderText('Posez une question sur votre code...')
    ).toBeInTheDocument()
  })

  it('should render with custom placeholder', () => {
    render(<ChatInput {...defaultProps} placeholder="Custom placeholder" />)

    expect(screen.getByPlaceholderText('Custom placeholder')).toBeInTheDocument()
  })

  it('should display the value prop', () => {
    render(<ChatInput {...defaultProps} value="Hello world" />)

    const textarea = screen.getByRole('textbox')
    expect(textarea).toHaveValue('Hello world')
  })

  it('should call onChange when typing', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<ChatInput {...defaultProps} onChange={onChange} />)

    const textarea = screen.getByRole('textbox')
    await user.type(textarea, 'H')

    expect(onChange).toHaveBeenCalledWith('H')
  })

  it('should call onSend when clicking send button', async () => {
    const user = userEvent.setup()
    const onSend = vi.fn()
    render(<ChatInput {...defaultProps} value="Hello world" onSend={onSend} />)

    const sendButton = screen.getByRole('button', { name: /envoyer/i })
    await user.click(sendButton)

    expect(onSend).toHaveBeenCalledWith('Hello world')
  })

  it('should call onChange with empty string after sending', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<ChatInput {...defaultProps} value="Hello world" onChange={onChange} />)

    const sendButton = screen.getByRole('button', { name: /envoyer/i })
    await user.click(sendButton)

    expect(onChange).toHaveBeenCalledWith('')
  })

  it('should disable send button when value is empty', () => {
    render(<ChatInput {...defaultProps} value="" />)

    const sendButton = screen.getByRole('button', { name: /envoyer/i })
    expect(sendButton).toBeDisabled()
  })

  it('should disable send button when value is only whitespace', () => {
    render(<ChatInput {...defaultProps} value="   " />)

    const sendButton = screen.getByRole('button', { name: /envoyer/i })
    expect(sendButton).toBeDisabled()
  })

  it('should enable send button when value has text', () => {
    render(<ChatInput {...defaultProps} value="Hello" />)

    const sendButton = screen.getByRole('button', { name: /envoyer/i })
    expect(sendButton).not.toBeDisabled()
  })

  it('should disable textarea when disabled prop is true', () => {
    render(<ChatInput {...defaultProps} disabled />)

    const textarea = screen.getByRole('textbox')
    expect(textarea).toBeDisabled()
  })

  it('should send on Cmd+Enter', () => {
    const onSend = vi.fn()
    render(<ChatInput {...defaultProps} value="Test message" onSend={onSend} />)

    const textarea = screen.getByRole('textbox')
    fireEvent.keyDown(textarea, { key: 'Enter', metaKey: true })

    expect(onSend).toHaveBeenCalledWith('Test message')
  })

  it('should send on Ctrl+Enter', () => {
    const onSend = vi.fn()
    render(<ChatInput {...defaultProps} value="Test message" onSend={onSend} />)

    const textarea = screen.getByRole('textbox')
    fireEvent.keyDown(textarea, { key: 'Enter', ctrlKey: true })

    expect(onSend).toHaveBeenCalledWith('Test message')
  })

  it('should not send on regular Enter', () => {
    const onSend = vi.fn()
    render(<ChatInput {...defaultProps} value="Test message" onSend={onSend} />)

    const textarea = screen.getByRole('textbox')
    fireEvent.keyDown(textarea, { key: 'Enter' })

    expect(onSend).not.toHaveBeenCalled()
  })

  it('should show keyboard shortcut hint', () => {
    render(<ChatInput {...defaultProps} />)

    expect(screen.getByText('Cmd')).toBeInTheDocument()
    expect(screen.getByText('Enter')).toBeInTheDocument()
  })

  it('should not send when disabled', () => {
    const onSend = vi.fn()
    render(<ChatInput {...defaultProps} value="Test" disabled onSend={onSend} />)

    const textarea = screen.getByRole('textbox')
    fireEvent.keyDown(textarea, { key: 'Enter', metaKey: true })

    expect(onSend).not.toHaveBeenCalled()
  })
})
