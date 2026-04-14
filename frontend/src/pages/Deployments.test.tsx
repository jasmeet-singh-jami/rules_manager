import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { Deployments } from './Deployments'
import * as api from '../api/client'

vi.mock('../api/client')

const mockClient = { id: 'c1', code: 'INFY', name: 'Infosys', description: null, created_at: '' }
const mockDeployments = [
  { id: 'd1', client_id: 'c1', version: 'v1.0', status: 'draft' as const, notes: 'First', created_at: '2024-01-01T10:00:00Z' },
]

beforeEach(() => {
  vi.mocked(api.getClients).mockResolvedValue([mockClient])
  vi.mocked(api.getDeployments).mockResolvedValue(mockDeployments)
  vi.mocked(api.createDeployment).mockResolvedValue({
    id: 'd2', client_id: 'c1', version: 'v2.0', status: 'draft', notes: null, created_at: ''
  })
  vi.mocked(api.exportDeployment).mockResolvedValue(new Response(new Blob(['zip']), { status: 200 }))
})

function renderWithRoute(clientId = 'c1') {
  return render(
    <MemoryRouter initialEntries={[`/clients/${clientId}/deployments`]}>
      <Routes>
        <Route path="/clients/:id/deployments" element={<Deployments />} />
      </Routes>
    </MemoryRouter>
  )
}

describe('Deployments page', () => {
  it('renders page heading', async () => {
    renderWithRoute()
    await waitFor(() => expect(screen.getByText(/deployments/i)).toBeInTheDocument())
  })

  it('lists existing deployments', async () => {
    renderWithRoute()
    await waitFor(() => screen.getByText('v1.0'))
    expect(screen.getByText('First')).toBeInTheDocument()
  })

  it('opens new deployment form on button click', async () => {
    renderWithRoute()
    await waitFor(() => screen.getByText('v1.0'))
    fireEvent.click(screen.getByRole('button', { name: /new deployment/i }))
    expect(screen.getByLabelText(/version/i)).toBeInTheDocument()
  })
})
