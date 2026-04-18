import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import { RuleEditor } from './RuleEditor'
import * as api from '../../api/client'
import type { RuleType, Client } from '../../api/client'

vi.mock('../../api/client')

const ruleTypes: RuleType[] = [
  { id: 'rt1', slug: 'alert_classifier', name: 'Alert Classifier', pipeline_stage: 1,
    drl_package: 'com.example', functions: [], imports: [] },
]
const clients: Client[] = [
  { id: 'c1', code: 'INFY', name: 'Infosys', description: null, created_at: '' },
]

beforeEach(() => {
  vi.mocked(api.createRule).mockResolvedValue({
    id: 'new1', client_id: 'c1', rule_type_id: 'rt1', name: 'TestRule',
    description: null, tool: null, condition_raw: 'cond', action_raw: 'act',
    condition_meta: null, action_meta: null, enabled: true,
    window: null, required_function_names: null, required_import_statements: null,
    created_at: '', updated_at: '',
  })
  vi.mocked(api.updateRule).mockResolvedValue({
    id: 'existing1', client_id: 'c1', rule_type_id: 'rt1', name: 'Updated',
    description: null, tool: null, condition_raw: 'cond', action_raw: 'act',
    condition_meta: null, action_meta: null, enabled: true,
    window: null, required_function_names: null, required_import_statements: null,
    created_at: '', updated_at: '',
  })
})

describe('RuleEditor', () => {
  it('renders the modal with form fields', () => {
    render(
      <RuleEditor
        rule={{}}
        ruleTypes={ruleTypes}
        clients={clients}
        defaultClientId="c1"
        defaultRuleTypeId="rt1"
        onSave={vi.fn()}
        onClose={vi.fn()}
      />
    )
    expect(screen.getByLabelText(/rule name/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/condition/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/action/i)).toBeInTheDocument()
  })

  it('calls onClose when Cancel is clicked', () => {
    const onClose = vi.fn()
    render(
      <RuleEditor rule={{}} ruleTypes={ruleTypes} clients={clients}
        onSave={vi.fn()} onClose={onClose} />
    )
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(onClose).toHaveBeenCalled()
  })

  it('calls createRule and onSave when saving a new rule', async () => {
    const onSave = vi.fn()
    render(
      <RuleEditor
        rule={{}}
        ruleTypes={ruleTypes}
        clients={clients}
        defaultClientId="c1"
        defaultRuleTypeId="rt1"
        onSave={onSave}
        onClose={vi.fn()}
      />
    )
    fireEvent.change(screen.getByLabelText(/rule name/i), { target: { value: 'TestRule' } })
    fireEvent.click(screen.getByRole('button', { name: /save/i }))
    await waitFor(() => expect(onSave).toHaveBeenCalled())
    expect(api.createRule).toHaveBeenCalled()
  })
})
