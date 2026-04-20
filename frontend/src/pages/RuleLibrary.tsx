import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Rule, RuleType, getRules, getRuleTypes, deleteRule, exportRules, copyRule } from '../api/client'
import { RuleEditor } from '../components/RuleEditor/RuleEditor'
import { useAuth } from '../context/AuthContext'
import { useClients } from '../context/ClientContext'

const TOOLS = ['Any', 'LogicMonitor', 'SCOM', 'Tivoli', 'Dynatrace', 'Solarwinds', 'Datadog']

const codeBlockStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 12,
  lineHeight: 1.6,
  background: 'rgba(15,30,58,0.06)',
  borderRadius: 8,
  padding: '10px 12px',
  color: 'var(--ink)',
  fontFamily: "'Fira Code', 'Consolas', monospace",
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
  maxHeight: 160,
  overflowY: 'auto',
}

const fieldLabelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  color: 'var(--muted)',
  marginBottom: 4,
}

export function RuleLibrary() {
  const { hasEditAccess } = useAuth()
  const { clients, selectedClientId } = useClients()
  const [ruleTypes, setRuleTypes] = useState<RuleType[]>([])
  const [rules, setRules] = useState<Rule[]>([])
  const [activeTabIdx, setActiveTabIdx] = useState(0)
  const [search, setSearch] = useState('')
  const [toolFilter, setToolFilter] = useState('')
  const [editingRule, setEditingRule] = useState<Partial<Rule> | null | 'new'>(null)
  const [loading, setLoading] = useState(false)
  const [selectedRuleIds, setSelectedRuleIds] = useState<Set<string>>(new Set())
  const [exporting, setExporting] = useState(false)
  const [expandedRuleIds, setExpandedRuleIds] = useState<Set<string>>(new Set())
  const [copyingRule, setCopyingRule] = useState<Rule | null>(null)
  const [copyClientId, setCopyClientId] = useState('')
  const [copying, setCopying] = useState(false)

  useEffect(() => {
    getRuleTypes()
      .then(rt => {
        setRuleTypes(rt.sort((a, b) => a.pipeline_stage - b.pipeline_stage))
      })
      .catch(() => {
        setRuleTypes([])
      })
  }, [])

  useEffect(() => {
    if (ruleTypes.length === 0) {
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    setSelectedRuleIds(new Set())
    setExpandedRuleIds(new Set())
    const rt = ruleTypes[activeTabIdx]
    getRules({
      client_id: selectedClientId || undefined,
      rule_type: rt?.slug,
      tool: toolFilter || undefined,
      search: search || undefined,
    })
      .then(data => { if (!cancelled) setRules(data) })
      .catch(() => { if (!cancelled) setRules([]) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [selectedClientId, activeTabIdx, toolFilter, search, ruleTypes])

  async function handleDelete(rule: Rule) {
    if (!confirm(`Delete rule "${rule.name}"?`)) return
    await deleteRule(rule.id)
    setRules(prev => prev.filter(r => r.id !== rule.id))
    setSelectedRuleIds(prev => { const n = new Set(prev); n.delete(rule.id); return n })
    setExpandedRuleIds(prev => { const n = new Set(prev); n.delete(rule.id); return n })
  }

  function handleSaved(rule: Rule) {
    setRules(prev => {
      const idx = prev.findIndex(r => r.id === rule.id)
      if (idx >= 0) return prev.map(r => r.id === rule.id ? rule : r)
      return [...prev, rule]
    })
    setEditingRule(null)
  }

  function toggleRule(id: string) {
    setSelectedRuleIds(prev => {
      const n = new Set(prev)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  }

  function toggleAll() {
    if (selectedRuleIds.size === rules.length) {
      setSelectedRuleIds(new Set())
    } else {
      setSelectedRuleIds(new Set(rules.map(r => r.id)))
    }
  }

  function toggleExpand(id: string) {
    setExpandedRuleIds(prev => {
      const n = new Set(prev)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  }

  async function handleExport() {
    if (selectedRuleIds.size === 0) return
    setExporting(true)
    try {
      const res = await exportRules([...selectedRuleIds])
      if (!res.ok) throw new Error('Export failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'rules_export.zip'
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      alert('Export failed. Please try again.')
    } finally {
      setExporting(false)
    }
  }

  async function handleCopyRule() {
    if (!copyingRule || !copyClientId) return
    setCopying(true)
    try {
      await copyRule(copyingRule.id, copyClientId)
      setCopyingRule(null)
      setCopyClientId('')
    } catch {
      alert('Copy failed. Please try again.')
    } finally {
      setCopying(false)
    }
  }

  const activeRuleType = ruleTypes[activeTabIdx]
  const allSelected = rules.length > 0 && selectedRuleIds.size === rules.length
  const someSelected = selectedRuleIds.size > 0 && !allSelected
  const writableClients = clients.filter(c => hasEditAccess(c.id))

  return (
    <>
      {/* Header bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '20px 0 16px' }}>
        <h2 style={{ margin: 0 }}>Rule Library</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          {selectedRuleIds.size > 0 && (
            <button
              className="btn-outline"
              onClick={handleExport}
              disabled={exporting}
            >
              {exporting ? 'Exporting…' : `Export Selected (${selectedRuleIds.size})`}
            </button>
          )}
          {selectedClientId && hasEditAccess(selectedClientId) && (
            <button className="btn-primary" onClick={() => setEditingRule('new')}>+ New Rule</button>
          )}
        </div>
      </div>

      {/* Rule type tabs */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 16, borderBottom: '2px solid var(--line)' }}>
        {ruleTypes.map((rt, i) => (
          <button
            key={rt.id}
            onClick={() => setActiveTabIdx(i)}
            style={{
              background: 'none', border: 'none',
              borderBottom: i === activeTabIdx ? '2px solid var(--accent)' : '2px solid transparent',
              borderRadius: 0, padding: '8px 16px',
              color: i === activeTabIdx ? 'var(--accent)' : 'var(--muted)',
              fontWeight: i === activeTabIdx ? 700 : 400,
              cursor: 'pointer', marginBottom: -2,
            }}
          >
            {rt.name}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
        <input
          placeholder="Search by name…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ width: 220 }}
        />
        <select aria-label="Tool filter" value={toolFilter} onChange={e => setToolFilter(e.target.value)} style={{ width: 160 }}>
          <option value="">Any</option>
          {TOOLS.filter(t => t !== 'Any').map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      {/* Rules table */}
      <div className="glass-card" style={{ overflow: 'hidden' }}>
        <table>
          <thead>
            <tr>
              <th style={{ width: 36 }}>
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={el => { if (el) el.indeterminate = someSelected }}
                  onChange={toggleAll}
                  disabled={rules.length === 0}
                />
              </th>
              <th>Name</th><th>Client</th><th>Tool</th><th>Enabled</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: 20 }} className="muted">Loading…</td></tr>
            )}
            {!loading && rules.map(rule => (
              <>
                <tr key={rule.id}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selectedRuleIds.has(rule.id)}
                      onChange={() => toggleRule(rule.id)}
                    />
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <button
                        onClick={() => toggleExpand(rule.id)}
                        title={expandedRuleIds.has(rule.id) ? 'Collapse' : 'Show details'}
                        style={{
                          background: 'none', border: 'none', padding: '2px 5px',
                          cursor: 'pointer', color: 'var(--muted)', fontSize: 11,
                          borderRadius: 4, flexShrink: 0, lineHeight: 1,
                          transition: 'color 0.15s, background 0.15s',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(29,106,229,0.1)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                      >
                        {expandedRuleIds.has(rule.id) ? '▾' : '▸'}
                      </button>
                      <strong>{rule.name}</strong>
                    </div>
                  </td>
                  <td>{clients.find(c => c.id === rule.client_id)?.name ?? <span className="muted">—</span>}</td>
                  <td>{rule.tool ?? <span className="muted">—</span>}</td>
                  <td>
                    <span className={`badge ${rule.enabled ? 'badge-ok' : 'badge-muted'}`}>
                      {rule.enabled ? 'Yes' : 'No'}
                    </span>
                  </td>
                  <td>
                    <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {hasEditAccess(rule.client_id) && (
                        <button className="btn-outline btn-sm" onClick={() => setEditingRule(rule)}>Edit</button>
                      )}
                      {hasEditAccess(rule.client_id) && (
                        <button className="btn-danger btn-sm" onClick={() => handleDelete(rule)}>Delete</button>
                      )}
                      {writableClients.some(c => c.id !== rule.client_id) && (
                        <button
                          className="btn-outline btn-sm"
                          onClick={() => { setCopyingRule(rule); setCopyClientId('') }}
                        >
                          Copy
                        </button>
                      )}
                    </span>
                  </td>
                </tr>
                {expandedRuleIds.has(rule.id) && (
                  <tr key={`${rule.id}-expanded`}>
                    <td colSpan={6} style={{
                      padding: '4px 16px 16px 52px',
                      background: 'rgba(29,106,229,0.03)',
                      borderBottom: '1px solid rgba(29,106,229,0.08)',
                    }}>
                      {rule.description && (
                        <div style={{ marginBottom: 12, marginTop: 10 }}>
                          <div style={fieldLabelStyle}>Description</div>
                          <p style={{ margin: 0, fontSize: 13, color: 'var(--ink)', lineHeight: 1.6 }}>
                            {rule.description}
                          </p>
                        </div>
                      )}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: rule.description ? 0 : 10 }}>
                        <div>
                          <div style={fieldLabelStyle}>Condition (when)</div>
                          <pre style={codeBlockStyle}>
                            {rule.condition_raw || <span style={{ color: 'var(--muted)', fontStyle: 'italic' }}>— not set —</span>}
                          </pre>
                        </div>
                        <div>
                          <div style={fieldLabelStyle}>Action (then)</div>
                          <pre style={codeBlockStyle}>
                            {rule.action_raw || <span style={{ color: 'var(--muted)', fontStyle: 'italic' }}>— not set —</span>}
                          </pre>
                        </div>
                      </div>
                      {((rule.required_function_names?.length ?? 0) > 0 || (rule.required_import_statements?.length ?? 0) > 0) && (
                        <div style={{ marginTop: 12 }}>
                          {(rule.required_function_names?.length ?? 0) > 0 && (
                            <div style={{ marginBottom: 6 }}>
                              <div style={fieldLabelStyle}>Uses functions</div>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                {rule.required_function_names!.map(fn => (
                                  <span key={fn} style={{ fontSize: 11, background: 'rgba(124,58,237,0.1)', color: 'var(--accent)', borderRadius: 4, padding: '2px 7px', fontFamily: 'monospace' }}>{fn}</span>
                                ))}
                              </div>
                            </div>
                          )}
                          {(rule.required_import_statements?.length ?? 0) > 0 && (
                            <div>
                              <div style={fieldLabelStyle}>Uses imports</div>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                {rule.required_import_statements!.map(imp => (
                                  <span key={imp} style={{ fontSize: 11, background: 'rgba(29,106,229,0.08)', color: 'var(--accent)', borderRadius: 4, padding: '2px 7px', fontFamily: 'monospace' }}>{imp.split('.').pop()?.replace(';', '') ?? imp}</span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                )}
              </>
            ))}
            {!loading && rules.length === 0 && (
              <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--muted)', padding: 24 }}>
                No rules for this client + rule type.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Rule Editor modal */}
      {editingRule !== null && (
        <RuleEditor
          rule={editingRule === 'new' ? {} : editingRule}
          ruleTypes={ruleTypes}
          clients={clients}
          defaultClientId={selectedClientId ?? undefined}
          defaultRuleTypeId={activeRuleType?.id}
          onSave={handleSaved}
          onClose={() => setEditingRule(null)}
        />
      )}

      {/* Copy Rule modal — portal escapes page-wrap stacking context */}
      {copyingRule && createPortal(
        <div className="modal-overlay" onClick={() => { setCopyingRule(null); setCopyClientId('') }}>
          <div className="modal" style={{ width: 460 }} onClick={e => e.stopPropagation()}>
            <h2>Copy Rule</h2>
            <p style={{ color: 'var(--muted)', margin: '0 0 20px', fontSize: 13 }}>
              Copying <strong style={{ color: 'var(--ink)' }}>{copyingRule.name}</strong> to another
              client. The copy will be saved as <code>{copyingRule.name}_copy</code>.
            </p>
            <div className="form-row">
              <label htmlFor="copy-target-client">Target Client</label>
              <select
                id="copy-target-client"
                value={copyClientId}
                onChange={e => setCopyClientId(e.target.value)}
              >
                <option value="">— select client —</option>
                {writableClients
                  .filter(c => c.id !== copyingRule.client_id)
                  .map(c => <option key={c.id} value={c.id}>{c.name} ({c.code})</option>)}
              </select>
            </div>
            <div className="form-actions">
              <button className="btn-outline" onClick={() => { setCopyingRule(null); setCopyClientId('') }}>
                Cancel
              </button>
              <button
                className="btn-primary"
                onClick={handleCopyRule}
                disabled={!copyClientId || copying}
              >
                {copying ? 'Copying…' : 'Copy Rule'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
