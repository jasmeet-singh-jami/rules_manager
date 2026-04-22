import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { RuleLibrary } from './RuleLibrary'

vi.mock('../context/ClientContext', () => ({
  useClients: () => ({ selectedClientId: 'c1', clients: [{ id: 'c1', code: 'INFY', name: 'Infy', description: null, created_at: '' }] }),
}))
vi.mock('../components/Toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))

const { getRuleTypes, getRules, updateRule } = vi.hoisted(() => ({
  getRuleTypes: vi.fn(async () => [
    { id: 'rt1', slug: 'noise-suppression', name: 'Noise Suppression', pipeline_stage: 1, drl_package: 'com.x', functions: [], imports: [] },
  ]),
  getRules: vi.fn(async () => [
    { id: 'r1', client_id: 'c1', rule_type_id: 'rt1', name: 'R1', description: null, tool: null, condition_raw: 'a == 1', action_raw: null, condition_meta: null, action_meta: null, enabled: true, window: null, required_function_names: null, required_import_statements: null, created_at: '', updated_at: new Date().toISOString() },
  ]),
  updateRule: vi.fn(async () => ({})),
}))

vi.mock('../api/client', () => ({ getRuleTypes, getRules, updateRule, deleteRule: vi.fn() }))

describe('RuleLibrary', () => {
  it('renders rule rows and toggles enabled', async () => {
    render(
      <MemoryRouter initialEntries={['/rules/noise-suppression']}>
        <Routes>
          <Route path="/rules/:slug" element={<RuleLibrary />} />
        </Routes>
      </MemoryRouter>,
    )
    await waitFor(() => expect(screen.getByText('R1')).toBeInTheDocument())
    const switches = screen.getAllByRole('checkbox')
    const enabledSwitch = switches.find(s => (s as HTMLInputElement).checked)!
    fireEvent.click(enabledSwitch)
    await waitFor(() => expect(updateRule).toHaveBeenCalledWith('r1', { enabled: false }))
  })

  it('shows empty state when no rules', async () => {
    getRules.mockResolvedValueOnce([])
    render(
      <MemoryRouter initialEntries={['/rules/noise-suppression']}>
        <Routes>
          <Route path="/rules/:slug" element={<RuleLibrary />} />
        </Routes>
      </MemoryRouter>,
    )
    await waitFor(() => expect(screen.getByText('No Noise Suppression rules yet')).toBeInTheDocument())
  })
})
