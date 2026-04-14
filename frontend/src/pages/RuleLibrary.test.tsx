import { render, screen, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { RuleLibrary } from './RuleLibrary'
import * as api from '../api/client'

vi.mock('../api/client')
vi.mock('../components/RuleEditor/RuleEditor', () => ({
  RuleEditor: () => <div data-testid="rule-editor" />,
}))

const mockClients = [
  { id: 'c1', code: 'INFY', name: 'Infosys', description: null, created_at: '' },
]
const mockRuleTypes = [
  { id: 'rt1', slug: 'alert_classifier', name: 'Alert Classifier', pipeline_stage: 1, drl_package: '', drl_imports: '', drl_functions: null },
  { id: 'rt2', slug: 'noise_suppression', name: 'Noise Suppression', pipeline_stage: 2, drl_package: '', drl_imports: '', drl_functions: null },
]
const mockRules = [
  { id: 'r1', client_id: 'c1', rule_type_id: 'rt1', name: 'AlertRule_1', description: null,
    tool: 'LogicMonitor', condition_raw: 'x', action_raw: 'y', condition_meta: null,
    action_meta: null, enabled: true, priority: 'P1', window: null, created_at: '', updated_at: '' },
]

beforeEach(() => {
  vi.mocked(api.getClients).mockResolvedValue(mockClients)
  vi.mocked(api.getRuleTypes).mockResolvedValue(mockRuleTypes)
  vi.mocked(api.getRules).mockResolvedValue(mockRules)
  vi.mocked(api.deleteRule).mockResolvedValue(undefined)
})

describe('RuleLibrary', () => {
  it('renders the page heading', () => {
    render(<MemoryRouter><RuleLibrary /></MemoryRouter>)
    expect(screen.getByText('Rule Library')).toBeInTheDocument()
  })

  it('shows client selector dropdown', async () => {
    render(<MemoryRouter><RuleLibrary /></MemoryRouter>)
    await waitFor(() => screen.getByText('Infosys (INFY)'))
    expect(screen.getByRole('combobox', { name: /client/i })).toBeInTheDocument()
  })

  it('shows rule type tabs after client selected', async () => {
    render(<MemoryRouter><RuleLibrary /></MemoryRouter>)
    await waitFor(() => screen.getByText('Alert Classifier'))
    expect(screen.getByText('Noise Suppression')).toBeInTheDocument()
  })

  it('shows rules in the table', async () => {
    render(<MemoryRouter><RuleLibrary /></MemoryRouter>)
    await waitFor(() => screen.getByText('AlertRule_1'))
    expect(screen.getAllByText('LogicMonitor').length).toBeGreaterThan(0)
  })
})
