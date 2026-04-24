import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { KnowledgeBase } from './KnowledgeBase'

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

const { getKnowledgeDocs } = vi.hoisted(() => ({
  getKnowledgeDocs: vi.fn(),
}))

vi.mock('../api/client', () => ({
  getKnowledgeDocs,
  uploadKnowledgeDoc: vi.fn(),
  downloadKnowledgeDoc: vi.fn(),
  deleteKnowledgeDoc: vi.fn(),
}))

function renderPage(category = 'integrations') {
  return render(
    <MemoryRouter initialEntries={[`/knowledge/${category}`]}>
      <Routes>
        <Route path="/knowledge/:category" element={<KnowledgeBase />} />
      </Routes>
    </MemoryRouter>
  )
}

describe('KnowledgeBase', () => {
  beforeEach(() => {
    getKnowledgeDocs.mockResolvedValue([])
  })

  it('renders the page title with category', async () => {
    renderPage('integrations')
    await waitFor(() => expect(screen.getByText(/Knowledge Base · Integrations/i)).toBeInTheDocument())
  })

  it('shows empty state when no documents', async () => {
    renderPage('integrations')
    await waitFor(() => expect(screen.getByText(/No documents yet/i)).toBeInTheDocument())
  })

  it('shows documents when loaded', async () => {
    getKnowledgeDocs.mockResolvedValue([{
      id: 'd1',
      client_id: 'c1',
      category: 'integrations',
      name: 'Splunk Guide',
      description: null,
      filename: 'splunk.pdf',
      file_size: 10240,
      mime_type: 'application/pdf',
      uploaded_by: null,
      created_at: new Date().toISOString(),
    }])
    renderPage('integrations')
    await waitFor(() => expect(screen.getByText('Splunk Guide')).toBeInTheDocument())
    expect(screen.getByText('splunk.pdf')).toBeInTheDocument()
  })

  it('shows upload button for users with edit access', async () => {
    renderPage('integrations')
    await waitFor(() => expect(screen.getByText(/Upload Document/i)).toBeInTheDocument())
  })
})
