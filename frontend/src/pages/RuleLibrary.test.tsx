import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { RuleLibrary } from './RuleLibrary'

const setSelectedClientId = vi.fn()

vi.mock('../context/ClientContext', () => ({
  useClients: () => ({
    selectedClientId: 'c1',
    setSelectedClientId,
    clients: [
      { id: 'c1', code: 'INFY', name: 'Infosys', description: null, created_at: '' },
      { id: 'c2', code: 'PVH', name: 'PVH', description: null, created_at: '' },
    ],
  }),
}))

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    hasEditAccess: (clientId: string) => clientId === 'c1' || clientId === 'c2',
  }),
}))

vi.mock('../components/Toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))

const { getRuleTypes, getRules, updateRule, copyRule, exportRules } = vi.hoisted(() => ({
  getRuleTypes: vi.fn(async () => [
    { id: 'rt1', slug: 'noise_suppression', name: 'Noise Suppression', pipeline_stage: 1, drl_package: 'com.x', functions: [], imports: [] },
  ]),
  getRules: vi.fn(async () => [
    {
      id: 'r1',
      client_id: 'c1',
      rule_type_id: 'rt1',
      name: 'R1',
      description: 'Rule description',
      tool: null,
      condition_raw: 'a == 1',
      action_raw: 'close();',
      condition_meta: null,
      action_meta: null,
      enabled: true,
      window: null,
      required_function_names: ['extractPort'],
      required_import_statements: ['import com.example.Alert;'],
      created_at: '',
      updated_at: new Date().toISOString(),
    },
  ]),
  updateRule: vi.fn(async () => ({})),
  copyRule: vi.fn(async () => ({
    id: 'r2',
    client_id: 'c2',
    rule_type_id: 'rt1',
    name: 'R1_copy',
    description: null,
    tool: null,
    condition_raw: 'a == 1',
    action_raw: null,
    condition_meta: null,
    action_meta: null,
    enabled: true,
    window: null,
    required_function_names: null,
    required_import_statements: null,
    created_at: '',
    updated_at: new Date().toISOString(),
  })),
  exportRules: vi.fn(async () => ({
    ok: true,
    blob: async () => new Blob(['zip']),
  })),
}))

vi.mock('../api/client', () => ({
  getRuleTypes,
  getRules,
  updateRule,
  deleteRule: vi.fn(),
  copyRule,
  exportRules,
}))

describe('RuleLibrary', () => {
  const originalCreateObjectURL = URL.createObjectURL
  const originalRevokeObjectURL = URL.revokeObjectURL

  beforeEach(() => {
    setSelectedClientId.mockReset()
    URL.createObjectURL = vi.fn(() => 'blob:rules')
    URL.revokeObjectURL = vi.fn()
  })

  afterEach(() => {
    URL.createObjectURL = originalCreateObjectURL
    URL.revokeObjectURL = originalRevokeObjectURL
  })

  it('renders rule rows with client info and toggles enabled', async () => {
    render(
      <MemoryRouter initialEntries={['/rules/noise_suppression']}>
        <Routes>
          <Route path="/rules/:slug" element={<RuleLibrary />} />
        </Routes>
      </MemoryRouter>,
    )

    await waitFor(() => expect(screen.getByText('R1')).toBeInTheDocument())
    expect(screen.getAllByText('Infosys')).toHaveLength(2)
    expect(getRules).toHaveBeenCalledWith({ client_id: 'c1', rule_type: 'noise_suppression' })

    const switches = screen.getAllByRole('checkbox')
    const enabledSwitch = switches.find(switchEl => (switchEl as HTMLInputElement).checked)!
    fireEvent.click(enabledSwitch)

    await waitFor(() => expect(updateRule).toHaveBeenCalledWith('r1', { enabled: false }))
  })

  it('expands a rule row to show condition and action', async () => {
    render(
      <MemoryRouter initialEntries={['/rules/noise_suppression']}>
        <Routes>
          <Route path="/rules/:slug" element={<RuleLibrary />} />
        </Routes>
      </MemoryRouter>,
    )

    await waitFor(() => expect(screen.getByText('R1')).toBeInTheDocument())
    expect(screen.queryByText('close();')).not.toBeInTheDocument()
    expect(screen.queryByText('fn:extractPort')).not.toBeInTheDocument()

    fireEvent.click(screen.getByLabelText('Expand R1'))

    expect(screen.getByText('Condition')).toBeInTheDocument()
    expect(screen.getByText('Action')).toBeInTheDocument()
    expect(screen.getByText('a == 1')).toBeInTheDocument()
    expect(screen.getByText('close();')).toBeInTheDocument()
  })

  it('copies a rule to another client', async () => {
    render(
      <MemoryRouter initialEntries={['/rules/noise_suppression']}>
        <Routes>
          <Route path="/rules/:slug" element={<RuleLibrary />} />
        </Routes>
      </MemoryRouter>,
    )

    await waitFor(() => expect(screen.getByText('R1')).toBeInTheDocument())
    fireEvent.click(screen.getByTitle('Copy'))
    fireEvent.change(screen.getByLabelText('Target client'), { target: { value: 'c2' } })
    fireEvent.click(screen.getByRole('button', { name: 'Copy rule' }))

    await waitFor(() => expect(copyRule).toHaveBeenCalledWith('r1', 'c2'))
  })

  it('exports selected rules', async () => {
    const originalCreateElement = document.createElement.bind(document)
    const anchorClick = vi.fn()
    const createElementSpy = vi.spyOn(document, 'createElement').mockImplementation(((tagName: string) => {
      const element = originalCreateElement(tagName)
      if (tagName.toLowerCase() === 'a') {
        element.click = anchorClick
      }
      return element
    }) as typeof document.createElement)

    render(
      <MemoryRouter initialEntries={['/rules/noise_suppression']}>
        <Routes>
          <Route path="/rules/:slug" element={<RuleLibrary />} />
        </Routes>
      </MemoryRouter>,
    )

    await waitFor(() => expect(screen.getByText('R1')).toBeInTheDocument())
    fireEvent.click(screen.getAllByRole('checkbox')[0])
    fireEvent.click(screen.getByRole('button', { name: /export/i }))

    await waitFor(() => expect(exportRules).toHaveBeenCalledWith(['r1']))
    expect(anchorClick).toHaveBeenCalled()

    createElementSpy.mockRestore()
  })
})
