import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { Clients } from './Clients'
import * as api from '../api/client'

vi.mock('../api/client')

const mockClients = [
  { id: '1', code: 'INFY', name: 'Infosys', description: 'Main client', created_at: '2024-01-01T00:00:00Z' },
]

describe('Clients page', () => {
  beforeEach(() => {
    vi.mocked(api.getClients).mockResolvedValue(mockClients)
    vi.mocked(api.createClient).mockResolvedValue({ ...mockClients[0], id: '2', code: 'NEW' })
    vi.mocked(api.updateClient).mockResolvedValue(mockClients[0])
    vi.mocked(api.deleteClient).mockResolvedValue(undefined)
  })

  it('renders page heading', async () => {
    render(<MemoryRouter><Clients /></MemoryRouter>)
    expect(screen.getByText('Clients')).toBeInTheDocument()
  })

  it('lists clients after load', async () => {
    render(<MemoryRouter><Clients /></MemoryRouter>)
    await waitFor(() => expect(screen.getByText('INFY')).toBeInTheDocument())
    expect(screen.getByText('Infosys')).toBeInTheDocument()
  })

  it('opens new client modal on button click', async () => {
    render(<MemoryRouter><Clients /></MemoryRouter>)
    await waitFor(() => screen.getByText('INFY'))
    fireEvent.click(screen.getByRole('button', { name: /new client/i }))
    expect(screen.getByLabelText(/client code/i)).toBeInTheDocument()
  })
})
