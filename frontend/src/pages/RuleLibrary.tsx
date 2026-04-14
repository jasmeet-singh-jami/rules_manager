import { useEffect, useState } from 'react'
import { Client, Rule, RuleType, getRules, getClients, getRuleTypes, deleteRule } from '../api/client'
import { RuleEditor } from '../components/RuleEditor/RuleEditor'

const TOOLS = ['Any', 'LogicMonitor', 'SCOM', 'Tivoli', 'Dynatrace', 'Solarwinds', 'Datadog']

export function RuleLibrary() {
  const [clients, setClients] = useState<Client[]>([])
  const [ruleTypes, setRuleTypes] = useState<RuleType[]>([])
  const [rules, setRules] = useState<Rule[]>([])
  const [selectedClientId, setSelectedClientId] = useState('')
  const [activeTabIdx, setActiveTabIdx] = useState(0)
  const [search, setSearch] = useState('')
  const [toolFilter, setToolFilter] = useState('')
  const [editingRule, setEditingRule] = useState<Partial<Rule> | null | 'new'>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    Promise.all([getClients(), getRuleTypes()])
      .then(([c, rt]) => {
        setClients(c)
        setRuleTypes(rt.sort((a, b) => a.pipeline_stage - b.pipeline_stage))
        if (c.length > 0) setSelectedClientId(c[0].id)
      })
      .catch(() => {
        setClients([])
        setRuleTypes([])
      })
  }, [])

  useEffect(() => {
    if (!selectedClientId || ruleTypes.length === 0) {
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    const rt = ruleTypes[activeTabIdx]
    getRules({
      client_id: selectedClientId,
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
  }

  function handleSaved(rule: Rule) {
    setRules(prev => {
      const idx = prev.findIndex(r => r.id === rule.id)
      if (idx >= 0) return prev.map(r => r.id === rule.id ? rule : r)
      return [...prev, rule]
    })
    setEditingRule(null)
  }

  const activeRuleType = ruleTypes[activeTabIdx]

  return (
    <>
      {/* Header bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '20px 0 16px' }}>
        <h2 style={{ margin: 0 }}>Rule Library</h2>
        <button
          className="btn-primary"
          disabled={!selectedClientId}
          onClick={() => setEditingRule('new')}
        >
          + Add Rule
        </button>
      </div>

      {/* Client selector */}
      <div style={{ marginBottom: 14 }}>
        <select
          aria-label="Client"
          value={selectedClientId}
          onChange={e => { setSelectedClientId(e.target.value); setActiveTabIdx(0) }}
          style={{ width: 260 }}
        >
          {clients.length === 0 && <option value="">Loading clients…</option>}
          {clients.map(c => (
            <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
          ))}
        </select>
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
      <div style={{ background: '#fff', borderRadius: 10, border: '1px solid var(--line)', overflow: 'hidden' }}>
        <table>
          <thead>
            <tr>
              <th>Name</th><th>Tool</th><th>Priority</th><th>Enabled</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={5} style={{ textAlign: 'center', padding: 20 }} className="muted">Loading…</td></tr>
            )}
            {!loading && rules.map(rule => (
              <tr key={rule.id}>
                <td><strong>{rule.name}</strong>
                  {rule.description && <div className="muted" style={{ fontSize: 12 }}>{rule.description}</div>}
                </td>
                <td>{rule.tool ?? <span className="muted">—</span>}</td>
                <td>{rule.priority ?? <span className="muted">—</span>}</td>
                <td>
                  <span className={`badge ${rule.enabled ? 'badge-ok' : 'badge-muted'}`}>
                    {rule.enabled ? 'Yes' : 'No'}
                  </span>
                </td>
                <td>
                  <span style={{ display: 'flex', gap: 6 }}>
                    <button className="btn-outline btn-sm" onClick={() => setEditingRule(rule)}>Edit</button>
                    <button className="btn-danger btn-sm" onClick={() => handleDelete(rule)}>Delete</button>
                  </span>
                </td>
              </tr>
            ))}
            {!loading && rules.length === 0 && (
              <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--muted)', padding: 24 }}>
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
          defaultClientId={selectedClientId}
          defaultRuleTypeId={activeRuleType?.id}
          onSave={handleSaved}
          onClose={() => setEditingRule(null)}
        />
      )}
    </>
  )
}
