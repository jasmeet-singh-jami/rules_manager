import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { CronJobs } from './CronJobs'

vi.mock('../context/ClientContext', () => ({
  useClients: () => ({
    clients: [
      { id: 'c1', code: 'INFY', name: 'Infosys', description: null, created_at: '' },
    ],
  }),
}))

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    hasEditAccess: () => true,
  }),
}))

vi.mock('../components/Toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))

const { getCronJobs } = vi.hoisted(() => ({
  getCronJobs: vi.fn(),
}))

vi.mock('../api/client', () => ({
  getCronJobs,
  uploadCronJob: vi.fn(),
  downloadCronJob: vi.fn(),
  deleteCronJob: vi.fn(),
}))

function renderPage() {
  return render(
    <MemoryRouter>
      <CronJobs />
    </MemoryRouter>
  )
}

describe('CronJobs', () => {
  beforeEach(() => {
    getCronJobs.mockResolvedValue([])
  })

  it('renders the page title', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByText('Cron Jobs')).toBeInTheDocument())
  })

  it('shows empty state when no jobs', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByText(/No cron jobs yet/i)).toBeInTheDocument())
  })

  it('shows jobs when loaded', async () => {
    getCronJobs.mockResolvedValue([{
      id: 'j1',
      client_id: 'c1',
      name: 'Nightly Sync',
      description: null,
      filename: 'sync.sh',
      file_size: 512,
      mime_type: 'application/x-sh',
      uploaded_by: null,
      created_at: new Date().toISOString(),
    }])
    renderPage()
    await waitFor(() => expect(screen.getByText('Nightly Sync')).toBeInTheDocument())
    expect(screen.getByText('sync.sh')).toBeInTheDocument()
  })

  it('shows upload button for users with edit access', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByText(/Upload Cron Job/i)).toBeInTheDocument())
  })
})
