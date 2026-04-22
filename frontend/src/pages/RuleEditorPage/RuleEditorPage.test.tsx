import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { RuleEditorPage } from './RuleEditorPage'

vi.mock('../../context/ClientContext', () => ({
  useClients: () => ({ selectedClientId: 'c1', clients: [] }),
}))
vi.mock('../../components/Toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))
const rt = { id: 'rt1', slug: 'noise-suppression', name: 'Noise Suppression',
             pipeline_stage: 1, drl_package: 'com.x', functions: [], imports: [] }
vi.mock('../../api/client', () => ({
  getRuleTypes: vi.fn(async () => [rt]),
  getRules: vi.fn(async () => []),
  createRule: vi.fn(async () => ({})),
  updateRule: vi.fn(async () => ({})),
}))

function renderEditor(path = '/rules/noise-suppression/new') {
  const router = createMemoryRouter(
    [{ path: '/rules/:slug/new', element: <RuleEditorPage /> }],
    { initialEntries: [path] },
  )
  return render(<RouterProvider router={router} />)
}

describe('RuleEditorPage (new)', () => {
  it('renders an empty form for /new', async () => {
    renderEditor()
    await waitFor(() => expect(screen.getByText('Create new rule')).toBeInTheDocument())
    expect(screen.getByText('Conditions')).toBeInTheDocument()
  })

  it('updates the DRL preview when the name changes', async () => {
    renderEditor()
    await waitFor(() => expect(screen.getByText('Create new rule')).toBeInTheDocument())
    const nameInput = screen.getAllByRole('textbox')[0]
    fireEvent.change(nameInput, { target: { value: 'MY_RULE' } })
    await waitFor(() => {
      const codeEl = document.querySelector('.code-src')
      expect(codeEl?.textContent).toContain('MY_RULE')
    })
  })
})
