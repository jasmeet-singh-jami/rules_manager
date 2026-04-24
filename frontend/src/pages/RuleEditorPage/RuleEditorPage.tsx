import { useCallback, useEffect, useMemo, useState } from 'react'
import { useBlocker, useNavigate, useParams } from 'react-router-dom'
import { useClients } from '../../context/ClientContext'
import {
  getRuleTypes, getRules, createRule, updateRule,
  type RuleType, type Rule,
} from '../../api/client'
import { Icon } from '../../components/Icon'
import { Switch } from '../../components/Switch'
import { DrlPreview } from '../../components/DrlPreview'
import { useToast } from '../../components/Toast'
import {
  parseCondition, stringifyCondition, CONDITION_OPS, type CondRow,
} from './conditionParser'
import { getActionPresets, getFieldSuggestions, getPrefix } from './presets'

type CondRowKeyed = { field: string; op: string; value: string; _key: string }

function buildDrl(rt: RuleType, rule: Partial<Rule>): string {
  const header =
    `package ${rt.drl_package};\n\n` +
    rt.imports.map(i => i.statement).join('\n') + '\n\n'
  const body =
    `// ${rule.description ?? ''}\n` +
    `rule "${rule.name || 'UnnamedRule'}"\n` +
    `    no-loop true\n` +
    `when\n` +
    `    ${rule.condition_raw || '/* condition */'}\n` +
    `then\n` +
    `    ${(rule.action_raw || '/* action */').split('\n').join('\n    ')}\n` +
    `end\n`
  return header + body
}

type FormState = {
  name: string
  description: string
  tool: string
  window: number | null
  enabled: boolean
  condition_raw: string
  action_raw: string
}

function emptyForm(): FormState {
  return {
    name: '',
    description: '',
    tool: '',
    window: null,
    enabled: true,
    condition_raw: '',
    action_raw: '',
  }
}

function formFromRule(rule: Rule): FormState {
  return {
    name: rule.name,
    description: rule.description ?? '',
    tool: rule.tool ?? '',
    window: rule.window,
    enabled: rule.enabled,
    condition_raw: rule.condition_raw ?? '',
    action_raw: rule.action_raw ?? '',
  }
}

export function RuleEditorPage() {
  const { slug, id } = useParams<{ slug: string; id?: string }>()
  const navigate = useNavigate()
  const { toast } = useToast()
  const { selectedClientId, bumpRulesVersion } = useClients()

  const [ruleTypes, setRuleTypes] = useState<RuleType[]>([])
  const [existing, setExisting] = useState<Rule | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [initial, setInitial] = useState<FormState>(emptyForm)
  const [manual, setManual] = useState(false)
  const [condRows, setCondRows] = useState<CondRowKeyed[]>([
    { field: '', op: '==', value: '', _key: crypto.randomUUID() },
  ])
  const [saving, setSaving] = useState(false)

  const rt = ruleTypes.find(ruleType => ruleType.slug === slug)
  const prefix = rt ? getPrefix(rt.slug) : ''
  const presets = rt ? getActionPresets(rt.slug) : []
  const fieldSugg = rt ? getFieldSuggestions(rt.slug) : []
  const requiredFunctionNames = existing?.required_function_names ?? []
  const requiredImportStatements = existing?.required_import_statements ?? []

  useEffect(() => { getRuleTypes().then(setRuleTypes).catch(() => {}) }, [])

  useEffect(() => {
    if (!id || !selectedClientId || !rt) return
    let cancelled = false
    getRules({ client_id: selectedClientId, rule_type: rt.slug }).then(rules => {
      if (cancelled) return
      const found = rules.find(rule => rule.id === id) ?? null
      setExisting(found)
      if (found) {
        const nextForm = formFromRule(found)
        setForm(nextForm)
        setInitial(nextForm)
        setCondRows(parseCondition(found.condition_raw ?? '', prefix)
          .map(row => ({ ...row, _key: crypto.randomUUID() })))
        setManual(false)
      }
    })
    return () => { cancelled = true }
  }, [id, rt?.slug, selectedClientId, prefix])

  useEffect(() => {
    if (manual) return
    setForm(current => ({ ...current, condition_raw: stringifyCondition(condRows as CondRow[], prefix) }))
  }, [condRows, manual, prefix])

  const drlText = useMemo(() => rt ? buildDrl(rt, form) : '', [rt, form])
  const isDirty = JSON.stringify(form) !== JSON.stringify(initial)

  const blocker = useBlocker(isDirty && !saving)

  useEffect(() => {
    if (blocker.state === 'blocked') {
      if (window.confirm('You have unsaved changes - discard them?')) {
        blocker.proceed()
      } else {
        blocker.reset()
      }
    }
  }, [blocker])

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (isDirty) {
        event.preventDefault()
        event.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [isDirty])

  const onSave = useCallback(async () => {
    if (!rt || !selectedClientId) return
    if (!form.name.trim()) {
      toast('Rule name is required', 'warn')
      return
    }
    if (!form.action_raw.trim()) {
      toast('Action is required', 'warn')
      return
    }
    setSaving(true)
    try {
      if (existing) {
        await updateRule(existing.id, {
          name: form.name,
          description: form.description || null,
          tool: form.tool || null,
          window: form.window,
          enabled: form.enabled,
          condition_raw: form.condition_raw,
          action_raw: form.action_raw,
        })
        toast('Rule updated', 'ok')
      } else {
        await createRule({
          client_id: selectedClientId,
          rule_type_id: rt.id,
          name: form.name,
          description: form.description || null,
          tool: form.tool || null,
          window: form.window,
          enabled: form.enabled,
          condition_raw: form.condition_raw,
          action_raw: form.action_raw,
          condition_meta: null,
          action_meta: null,
          required_function_names: null,
          required_import_statements: null,
        })
        toast('Rule created', 'ok')
      }
      setInitial(form)
      bumpRulesVersion()
      navigate(`/rules/${rt.slug}`)
    } catch {
      toast('Save failed', 'danger')
    } finally {
      setSaving(false)
    }
  }, [rt, selectedClientId, existing, form, navigate, toast, bumpRulesVersion])

  if (!rt) return <div className="page"><div className="empty">Loading...</div></div>

  const update = (patch: Partial<FormState>) => setForm(current => ({ ...current, ...patch }))

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="breadcrumb" style={{ marginBottom: 6 }}>
            <span className="sep">Rules</span>
            <span className="sep"> · </span>
            <span className="sep" style={{ cursor: 'pointer' }}
                  onClick={() => navigate(`/rules/${rt.slug}`)}>{rt.name}</span>
            <span className="sep"> · </span>
            <span className="current">{existing ? existing.id : 'New rule'}</span>
          </div>
          <h1 className="page-title">{existing ? `Edit rule ${existing.name}` : 'Create new rule'}</h1>
          <div className="page-sub">Changes preview live on the right.</div>
        </div>
        <div className="page-actions">
          <button className="btn sm ghost" onClick={() => navigate(`/rules/${rt.slug}`)}>Cancel</button>
          <button className="btn sm accent" onClick={onSave} disabled={saving}>
            <Icon name="save" /> {saving ? 'Saving...' : 'Save rule'}
          </button>
        </div>
      </div>

      <div className="editor-wrap">
        <div className="editor-main">
          <div className="editor-section">
            <div className="editor-section-head">
              <div>
                <div className="editor-section-title"><span className="num">1</span> Identification</div>
                <div className="editor-section-desc">Identify where and how this rule applies.</div>
              </div>
              <div className="hstack">
                <span className="small muted">Enabled</span>
                <Switch checked={form.enabled} onChange={value => update({ enabled: value })} />
              </div>
            </div>
            <div className="form-row">
              <div className="field">
                <label>Name</label>
                <input type="text" value={form.name} onChange={e => update({ name: e.target.value })} />
              </div>
              <div className="field">
                <label>Tool</label>
                <input type="text" value={form.tool} onChange={e => update({ tool: e.target.value })} />
              </div>
            </div>
            <div style={{ height: 12 }} />
            <div className="field">
              <label>Description</label>
              <input
                value={form.description}
                onChange={e => update({ description: e.target.value })}
                placeholder="Describe what this rule does in plain English"
              />
            </div>
          </div>

          <div className="editor-section">
            <div className="editor-section-head">
              <div>
                <div className="editor-section-title">
                  <span className="num">2</span> Conditions
                  {prefix && <span className="badge accent mono" style={{ marginLeft: 8 }}>{prefix}.*</span>}
                </div>
                <div className="editor-section-desc">
                  Joined with <span className="mono">&&</span>.
                  {prefix ? ` Prefix ${prefix}. applied automatically.` : ' No prefix.'}
                </div>
              </div>
              <div className="hstack">
                <label className="small muted hstack">
                  <input type="checkbox" className="cbx" checked={manual}
                         onChange={e => setManual(e.target.checked)} />
                  Manual DRL
                </label>
                {!manual && (
                  <button className="btn sm" onClick={() => setCondRows(rows => [
                    ...rows,
                    { field: '', op: '==', value: '', _key: crypto.randomUUID() },
                  ])}>
                    <Icon name="plus" /> Add
                  </button>
                )}
              </div>
            </div>

            {manual ? (
              <div className="field">
                <textarea
                  value={form.condition_raw}
                  onChange={e => update({ condition_raw: e.target.value })}
                  placeholder='e.g. sourceId == "LogicMonitor" && severity > 3'
                />
              </div>
            ) : (
              <div className="builder">
                {condRows.map((row, index) => (
                  <div key={row._key}>
                    <div className="kv-row">
                      <input
                        list="cond-fields"
                        value={row.field}
                        placeholder="field"
                        onChange={e => setCondRows(rows => rows.map((current, currentIndex) => (
                          currentIndex === index ? { ...current, field: e.target.value } : current
                        )))}
                      />
                      <select
                        value={row.op}
                        onChange={e => setCondRows(rows => rows.map((current, currentIndex) => (
                          currentIndex === index ? { ...current, op: e.target.value } : current
                        )))}
                      >
                        {CONDITION_OPS.map(op => <option key={op} value={op}>{op}</option>)}
                      </select>
                      <input
                        className="mono"
                        value={row.value}
                        placeholder="value"
                        onChange={e => setCondRows(rows => rows.map((current, currentIndex) => (
                          currentIndex === index ? { ...current, value: e.target.value } : current
                        )))}
                      />
                      <button className="kv-del" title="Remove"
                              onClick={() => setCondRows(rows => rows.filter((_, currentIndex) => currentIndex !== index))}>
                        <Icon name="x" size={14} />
                      </button>
                    </div>
                    {index < condRows.length - 1 && <div className="kv-joiner">AND</div>}
                  </div>
                ))}
                <datalist id="cond-fields">
                  {fieldSugg.map(field => <option key={field} value={field} />)}
                </datalist>
              </div>
            )}
          </div>

          <div className="editor-section">
            <div className="editor-section-head">
              <div>
                <div className="editor-section-title"><span className="num">3</span> Actions</div>
                <div className="editor-section-desc">Executed when conditions match.</div>
              </div>
              <select
                className="select"
                value=""
                onChange={e => {
                  const preset = presets.find(current => current.key === e.target.value)
                  if (preset?.template) {
                    update({ action_raw: form.action_raw ? `${form.action_raw}\n${preset.template}` : preset.template })
                  }
                  e.target.value = ''
                }}
              >
                <option value="">+ Add preset...</option>
                {presets.map(preset => <option key={preset.key} value={preset.key}>{preset.label}</option>)}
              </select>
            </div>
            <div className="field">
              <textarea
                value={form.action_raw}
                onChange={e => update({ action_raw: e.target.value })}
                placeholder='e.g. request.getGroupedAlert().setState("Closed");'
                style={{ minHeight: 140 }}
              />
            </div>
          </div>

          {existing && (
            <div className="editor-section">
              <div className="editor-section-head">
                <div>
                  <div className="editor-section-title"><span className="num">4</span> Dependencies</div>
                  <div className="editor-section-desc">Tracked functions and imports used by this rule.</div>
                </div>
              </div>
              {requiredFunctionNames.length === 0 && requiredImportStatements.length === 0 ? (
                <div className="small muted">No tracked functions or imports for this rule.</div>
              ) : (
                <div className="vstack">
                  {requiredFunctionNames.length > 0 && (
                    <div className="field">
                      <label>Functions</label>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {requiredFunctionNames.map(name => (
                          <span key={name} className="badge accent mono">{name}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {requiredImportStatements.length > 0 && (
                    <div className="field">
                      <label>Imports</label>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {requiredImportStatements.map(statement => (
                          <span key={statement} className="badge neutral mono">{statement}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {existing && (
            <div className="editor-section">
              <div className="editor-section-head">
                <div>
                  <div className="editor-section-title"><span className="num">5</span> Metadata</div>
                  <div className="editor-section-desc">Read-only.</div>
                </div>
              </div>
              <div className="form-row">
                <div className="field readonly"><label>Rule ID</label><input value={existing.id} readOnly /></div>
                <div className="field readonly"><label>Created</label><input value={new Date(existing.created_at).toLocaleString()} readOnly /></div>
                <div className="field readonly"><label>Updated</label><input value={new Date(existing.updated_at).toLocaleString()} readOnly /></div>
              </div>
            </div>
          )}
        </div>

        <DrlPreview text={drlText} filename={`${rt.slug}.drl`} />
      </div>
    </div>
  )
}
