import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Rule, RuleType, Client, createRule, updateRule } from '../../api/client'
import { DrlPreview } from '../DrlPreview'

const TOOLS = ['', 'LogicMonitor', 'SCOM', 'Tivoli', 'Dynatrace', 'Solarwinds', 'Datadog', 'Any']
const PRIORITIES = ['', 'P1', 'P2', 'P3', 'P4']

interface Props {
  rule: Partial<Rule>
  ruleTypes: RuleType[]
  clients: Client[]
  defaultClientId?: string
  defaultRuleTypeId?: string
  onSave: (rule: Rule) => void
  onClose: () => void
}

export function RuleEditor({ rule, ruleTypes, clients, defaultClientId, defaultRuleTypeId, onSave, onClose }: Props) {
  const isNew = !rule.id

  const [form, setForm] = useState({
    client_id: rule.client_id ?? defaultClientId ?? '',
    rule_type_id: rule.rule_type_id ?? defaultRuleTypeId ?? '',
    name: rule.name ?? '',
    description: rule.description ?? '',
    tool: rule.tool ?? '',
    condition_raw: rule.condition_raw ?? '',
    action_raw: rule.action_raw ?? '',
    enabled: rule.enabled ?? true,
    priority: rule.priority ?? '',
    window: rule.window?.toString() ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const set = (k: string, v: string | boolean) => setForm(f => ({ ...f, [k]: v }))

  const activeRuleType = ruleTypes.find(rt => rt.id === form.rule_type_id)

  async function handleSave() {
    if (!form.name.trim()) { setError('Rule name is required'); return }
    if (!form.client_id) { setError('Client is required'); return }
    if (!form.rule_type_id) { setError('Rule type is required'); return }
    setSaving(true)
    setError('')
    try {
      const payload = {
        client_id: form.client_id,
        rule_type_id: form.rule_type_id,
        name: form.name.trim(),
        description: form.description || null,
        tool: form.tool || null,
        condition_raw: form.condition_raw || null,
        action_raw: form.action_raw || null,
        condition_meta: null,
        action_meta: null,
        enabled: form.enabled,
        priority: form.priority || null,
        window: form.window ? parseInt(form.window) : null,
        required_function_names: rule.required_function_names ?? null,
        required_import_statements: rule.required_import_statements ?? null,
      }
      const saved = isNew
        ? await createRule(payload)
        : await updateRule(rule.id!, payload)
      onSave(saved)
    } catch {
      setError('Save failed — check the form and try again')
    } finally {
      setSaving(false)
    }
  }

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ width: 1000 }} onClick={e => e.stopPropagation()}>
        <h2>{isNew ? 'New Rule' : `Edit: ${rule.name}`}</h2>
        {error && <p className="error-msg">{error}</p>}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          {/* Left: form fields */}
          <div style={{ minWidth: 0 }}>
            <div className="form-grid" style={{ marginBottom: 14 }}>
              <div className="form-row">
                <label htmlFor="re-client">Client</label>
                <select id="re-client" value={form.client_id} onChange={e => set('client_id', e.target.value)}>
                  <option value="">— select —</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name} ({c.code})</option>)}
                </select>
              </div>
              <div className="form-row">
                <label htmlFor="re-ruletype">Rule Type</label>
                <select id="re-ruletype" value={form.rule_type_id} onChange={e => set('rule_type_id', e.target.value)}>
                  <option value="">— select —</option>
                  {ruleTypes.map(rt => <option key={rt.id} value={rt.id}>{rt.name}</option>)}
                </select>
              </div>
            </div>

            <div className="form-row">
              <label htmlFor="re-name">Rule Name</label>
              <input id="re-name" value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. LogicMonitorNoiseSuppression_8" />
            </div>

            <div className="form-row">
              <label htmlFor="re-desc">Description</label>
              <input id="re-desc" value={form.description} onChange={e => set('description', e.target.value)} placeholder="Optional plain English description" />
            </div>

            <div className="form-grid" style={{ marginBottom: 14 }}>
              <div className="form-row">
                <label htmlFor="re-tool">Tool</label>
                <select id="re-tool" value={form.tool} onChange={e => set('tool', e.target.value)}>
                  {TOOLS.map(t => <option key={t} value={t}>{t || 'Any / unset'}</option>)}
                </select>
              </div>
              <div className="form-row">
                <label htmlFor="re-priority">Priority</label>
                <select id="re-priority" value={form.priority} onChange={e => set('priority', e.target.value)}>
                  {PRIORITIES.map(p => <option key={p} value={p}>{p || '— none —'}</option>)}
                </select>
              </div>
            </div>

            <div className="form-row" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <input type="checkbox" id="re-enabled" checked={form.enabled}
                onChange={e => set('enabled', e.target.checked)} style={{ width: 'auto' }} />
              <label htmlFor="re-enabled" style={{ margin: 0 }}>Enabled</label>
            </div>

            <div className="form-row">
              <label htmlFor="re-condition">Condition (when)</label>
              <textarea id="re-condition" rows={6} value={form.condition_raw}
                onChange={e => set('condition_raw', e.target.value)}
                placeholder={'alert:IPPAlert(sourceId == "LogicMonitor")'} />
            </div>

            <div className="form-row">
              <label htmlFor="re-action">Action (then)</label>
              <textarea id="re-action" rows={5} value={form.action_raw}
                onChange={e => set('action_raw', e.target.value)}
                placeholder={'alert.setServiceName("event_mgmt_sw_1");'} />
            </div>
          </div>

          {/* Right: DRL preview — sticky so it stays visible while scrolling the form */}
          <div style={{ minWidth: 0, position: 'sticky', top: 0, alignSelf: 'flex-start' }}>
            <DrlPreview
              ruleName={form.name}
              conditionRaw={form.condition_raw}
              actionRaw={form.action_raw}
              ruleTypeName={activeRuleType?.name}
            />
          </div>
        </div>

        <div className="form-actions">
          <button className="btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save Rule'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
