import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeAll } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { CommandPalette } from './CommandPalette'

// cmdk uses ResizeObserver and scrollIntoView internally; polyfill for jsdom
beforeAll(() => {
  if (!window.ResizeObserver) {
    window.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  }
  if (!window.HTMLElement.prototype.scrollIntoView) {
    window.HTMLElement.prototype.scrollIntoView = vi.fn()
  }
})

vi.mock('../../api/client', () => ({
  getRules: vi.fn(async () => []),
  getClients: vi.fn(async () => []),
  getRuleTypes: vi.fn(async () => []),
}))
vi.mock('../Toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))

describe('CommandPalette', () => {
  it('renders when open and hides when closed', () => {
    const onClose = vi.fn()
    const { rerender } = render(<MemoryRouter><CommandPalette open={false} onClose={onClose} /></MemoryRouter>)
    expect(screen.queryByPlaceholderText(/Search rules/i)).not.toBeInTheDocument()
    rerender(<MemoryRouter><CommandPalette open={true} onClose={onClose} /></MemoryRouter>)
    expect(screen.getByPlaceholderText(/Search rules/i)).toBeInTheDocument()
  })

  it('closes when backdrop clicked', () => {
    const onClose = vi.fn()
    const { container } = render(<MemoryRouter><CommandPalette open={true} onClose={onClose} /></MemoryRouter>)
    fireEvent.click(container.querySelector('.cmdk-backdrop')!)
    expect(onClose).toHaveBeenCalled()
  })
})
