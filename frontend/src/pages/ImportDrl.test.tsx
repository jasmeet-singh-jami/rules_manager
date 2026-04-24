import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { ImportDrl } from './ImportDrl'

const setSelectedClientId = vi.fn()
const toast = vi.fn()

vi.mock('../context/ClientContext', () => ({
  useClients: () => ({
    clients: [
      { id: 'c1', code: 'INFY', name: 'Infosys', description: null, created_at: '' },
      { id: 'c2', code: 'PVH', name: 'PVH', description: null, created_at: '' },
    ],
    selectedClientId: 'c1',
    setSelectedClientId,
  }),
}))

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    hasEditAccess: (clientId: string) => clientId === 'c1',
  }),
}))

vi.mock('../components/Toast', () => ({ useToast: () => ({ toast }) }))

const { getRuleTypes, getRules, confirmImport } = vi.hoisted(() => ({
  getRuleTypes: vi.fn(async () => [
    { id: 'rt1', slug: 'alert_classifier', name: 'Alert Classifier', pipeline_stage: 1, drl_package: 'com.x', functions: [], imports: [] },
  ]),
  getRules: vi.fn(async () => []),
  confirmImport: vi.fn(async () => ({ imported: 1, rule_ids: ['r1'] })),
}))

vi.mock('../api/client', () => ({
  getRuleTypes,
  getRules,
  parseDrlFile: vi.fn(),
  confirmImport,
}))

describe('ImportDrl', () => {
  it('shows accessible clients and loads duplicate names for the selected client and rule type', async () => {
    render(
      <MemoryRouter>
        <ImportDrl />
      </MemoryRouter>,
    )

    const selects = await screen.findAllByRole('combobox')
    expect(screen.getByRole('option', { name: 'INFY - Infosys' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'PVH - PVH' })).toBeInTheDocument()

    fireEvent.change(selects[1], { target: { value: 'rt1' } })
    await waitFor(() => expect(getRules).toHaveBeenCalledWith({ client_id: 'c1', rule_type: 'alert_classifier' }))

    fireEvent.change(selects[0], { target: { value: 'c2' } })
    expect(setSelectedClientId).toHaveBeenCalledWith('c2')
    await waitFor(() => expect(getRules).toHaveBeenLastCalledWith({ client_id: 'c2', rule_type: 'alert_classifier' }))
  })

  it('preselects the requested rule type from the URL', async () => {
    render(
      <MemoryRouter initialEntries={['/import?rule_type=alert_classifier']}>
        <ImportDrl />
      </MemoryRouter>,
    )

    const selects = await screen.findAllByRole('combobox')
    await waitFor(() => expect(selects[1]).toHaveValue('rt1'))
  })
})
