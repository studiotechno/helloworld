import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useNewConversationShortcut } from './use-keyboard-shortcuts'

// Mock next/navigation
const mockPush = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}))

describe('useNewConversationShortcut', () => {
  beforeEach(() => {
    mockPush.mockClear()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('navigates to /chat on ⌘+N (Mac)', () => {
    renderHook(() => useNewConversationShortcut())

    const event = new KeyboardEvent('keydown', {
      key: 'n',
      metaKey: true,
      bubbles: true,
    })
    document.dispatchEvent(event)

    expect(mockPush).toHaveBeenCalledWith('/chat')
    expect(mockPush).toHaveBeenCalledTimes(1)
  })

  it('navigates to /chat on Ctrl+N (Windows/Linux)', () => {
    renderHook(() => useNewConversationShortcut())

    const event = new KeyboardEvent('keydown', {
      key: 'n',
      ctrlKey: true,
      bubbles: true,
    })
    document.dispatchEvent(event)

    expect(mockPush).toHaveBeenCalledWith('/chat')
    expect(mockPush).toHaveBeenCalledTimes(1)
  })

  it('handles uppercase N key', () => {
    renderHook(() => useNewConversationShortcut())

    const event = new KeyboardEvent('keydown', {
      key: 'N',
      metaKey: true,
      bubbles: true,
    })
    document.dispatchEvent(event)

    expect(mockPush).toHaveBeenCalledWith('/chat')
  })

  it('does not navigate on regular N keypress without modifier', () => {
    renderHook(() => useNewConversationShortcut())

    const event = new KeyboardEvent('keydown', {
      key: 'n',
      bubbles: true,
    })
    document.dispatchEvent(event)

    expect(mockPush).not.toHaveBeenCalled()
  })

  it('does not navigate when input is focused', () => {
    // Create and focus an input element
    const input = document.createElement('input')
    document.body.appendChild(input)
    input.focus()

    renderHook(() => useNewConversationShortcut())

    const event = new KeyboardEvent('keydown', {
      key: 'n',
      metaKey: true,
      bubbles: true,
    })
    document.dispatchEvent(event)

    expect(mockPush).not.toHaveBeenCalled()

    // Cleanup
    document.body.removeChild(input)
  })

  it('does not navigate when textarea is focused', () => {
    // Create and focus a textarea element
    const textarea = document.createElement('textarea')
    document.body.appendChild(textarea)
    textarea.focus()

    renderHook(() => useNewConversationShortcut())

    const event = new KeyboardEvent('keydown', {
      key: 'n',
      metaKey: true,
      bubbles: true,
    })
    document.dispatchEvent(event)

    expect(mockPush).not.toHaveBeenCalled()

    // Cleanup
    document.body.removeChild(textarea)
  })

  it('does not navigate when contenteditable element is focused', () => {
    // Create and focus a contenteditable element
    const div = document.createElement('div')
    div.setAttribute('contenteditable', 'true')
    document.body.appendChild(div)
    div.focus()

    renderHook(() => useNewConversationShortcut())

    const event = new KeyboardEvent('keydown', {
      key: 'n',
      metaKey: true,
      bubbles: true,
    })
    document.dispatchEvent(event)

    expect(mockPush).not.toHaveBeenCalled()

    // Cleanup
    document.body.removeChild(div)
  })

  it('cleans up event listener on unmount', () => {
    const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener')

    const { unmount } = renderHook(() => useNewConversationShortcut())
    unmount()

    expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function))

    removeEventListenerSpy.mockRestore()
  })
})
