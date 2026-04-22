import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { Sidebar } from './Sidebar'

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    user: { username: 'alice', role: 'admin' },
    isAdmin: true,
    logout: vi.fn(),
  }),
}))
vi.mock('../../context/ClientContext', () => ({
  useClients: () => ({ clients: [], selectedClientId: null, setSelectedClientId: vi.fn() }),
}))
vi.mock('../../api/client', () => ({
  getRuleTypes: vi.fn(async () => []),
  getRules: vi.fn(async () => []),
}))

describe('Sidebar', () => {
  it('renders workspace + settings nav entries', () => {
    render(<MemoryRouter><Sidebar /></MemoryRouter>)
    expect(screen.getByText('Overview')).toBeInTheDocument()
    expect(screen.getByText('Rules')).toBeInTheDocument()
    expect(screen.getByText('Admin')).toBeInTheDocument()
  })
})
