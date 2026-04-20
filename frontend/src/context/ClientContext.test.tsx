import { render, screen, waitFor, act } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ClientProvider, useClients } from './ClientContext'

vi.mock('../api/client', () => ({
  getClients: vi.fn(async () => [
    { id: '1', code: 'INFY', name: 'Infosys', description: null, created_at: '' },
    { id: '2', code: 'PVH', name: 'PVH', description: null, created_at: '' },
  ]),
}))

function Probe() {
  const ctx = useClients()
  return (
    <div>
      <span data-testid="selected">{ctx.selectedClientId ?? 'none'}</span>
      <span data-testid="count">{ctx.clients.length}</span>
      <button onClick={() => ctx.setSelectedClientId('2')}>pick</button>
    </div>
  )
}

describe('ClientContext', () => {
  beforeEach(() => localStorage.clear())

  it('loads clients and auto-selects first when no saved selection', async () => {
    render(<ClientProvider><Probe /></ClientProvider>)
    await waitFor(() => expect(screen.getByTestId('count').textContent).toBe('2'))
    expect(screen.getByTestId('selected').textContent).toBe('1')
  })

  it('persists selection to localStorage', async () => {
    render(<ClientProvider><Probe /></ClientProvider>)
    await waitFor(() => expect(screen.getByTestId('count').textContent).toBe('2'))
    act(() => { screen.getByText('pick').click() })
    expect(localStorage.getItem('polycloud.selectedClientId')).toBe('2')
  })

  it('restores selection from localStorage', async () => {
    localStorage.setItem('polycloud.selectedClientId', '2')
    render(<ClientProvider><Probe /></ClientProvider>)
    await waitFor(() => expect(screen.getByTestId('selected').textContent).toBe('2'))
  })
})
