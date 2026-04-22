import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useClients } from '../context/ClientContext'
import {
  getRuleTypes, getRules, updateRule, deleteRule,
  type RuleType, type Rule,
} from '../api/client'
import { Icon } from '../components/Icon'
import { Switch } from '../components/Switch'
import { SkeletonRows } from '../components/Skeleton'
import { EmptyState } from '../components/EmptyState'
import { useToast } from '../components/Toast'

const PAGE_SIZE = 25

export function RuleLibrary() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const { toast } = useToast()
  const { selectedClientId } = useClients()

  const [ruleTypes, setRuleTypes] = useState<RuleType[]>([])
  const [rules, setRules] = useState<Rule[]>([])
  const [loading, setLoading] = useState(false)
  const [q, setQ] = useState('')
  const [tool, setTool] = useState<string>('')
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [page, setPage] = useState(0)

  const rt = ruleTypes.find(r => r.slug === slug)

  useEffect(() => { getRuleTypes().then(setRuleTypes).catch(() => {}) }, [])

  useEffect(() => {
    if (!rt || !selectedClientId) return
    let cancelled = false
    setLoading(true)
    setSel(new Set())
    setPage(0)
    getRules({ client_id: selectedClientId, rule_type: rt.id })
      .then(data => { if (!cancelled) setRules(data) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [rt?.id, selectedClientId])

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase()
    return rules.filter(r =>
      (!tool || r.tool === tool) &&
      (!ql || r.name.toLowerCase().includes(ql) ||
              (r.description ?? '').toLowerCase().includes(ql) ||
              (r.condition_raw ?? '').toLowerCase().includes(ql))
    )
  }, [rules, q, tool])

  const pageRules = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const enabledCount = rules.filter(r => r.enabled).length
  const tools = Array.from(new Set(rules.map(r => r.tool).filter(Boolean))) as string[]

  const toggleEnabled = async (r: Rule) => {
    const next = !r.enabled
    setRules(prev => prev.map(x => x.id === r.id ? { ...x, enabled: next } : x))
    try {
      await updateRule(r.id, { enabled: next })
      toast(next ? 'Rule enabled' : 'Rule disabled', 'ok')
    } catch {
      setRules(prev => prev.map(x => x.id === r.id ? { ...x, enabled: !next } : x))
      toast('Failed to update rule', 'danger')
    }
  }

  const toggleSel = (id: string) => {
    setSel(prev => { const n = new Set(prev); if (n.has(id)) { n.delete(id) } else { n.add(id) } return n })
  }
  const toggleAll = () => {
    setSel(prev =>
      pageRules.length > 0 && pageRules.every(r => prev.has(r.id))
        ? new Set()
        : new Set(pageRules.map(r => r.id))
    )
  }
  const onBulkDelete = async () => {
    if (!confirm(`Delete ${sel.size} rule(s)?`)) return
    try {
      await Promise.all(Array.from(sel).map(id => deleteRule(id)))
      setRules(prev => prev.filter(r => !sel.has(r.id)))
      setSel(new Set())
      toast('Rules deleted', 'ok')
    } catch {
      toast('Failed to delete rules', 'danger')
    }
  }

  if (!selectedClientId) {
    return <div className="page"><EmptyState icon="clients" title="Pick a client"
      body="Use the switcher in the sidebar footer to choose a workspace." /></div>
  }
  if (!rt) return <div className="page"><div className="empty">Rule type not found</div></div>

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">{rt.name}</h1>
          <div className="page-sub">
            <span className="mono">{rt.drl_package}</span>
            <span style={{ margin: '0 6px', color: 'var(--muted-2)' }}>·</span>
            {enabledCount} of {rules.length} enabled
          </div>
        </div>
        <div className="page-actions">
          <button className="btn sm accent" onClick={() => navigate(`/rules/${rt.slug}/new`)}>
            <Icon name="plus" /> New rule
          </button>
        </div>
      </div>

      <div className="toolbar">
        <div className="tb-input">
          <Icon name="search" />
          <input value={q} onChange={e => setQ(e.target.value)}
                 placeholder={`Search ${rt.name.toLowerCase()}…`} />
        </div>
        <select className="select" value={tool} onChange={e => setTool(e.target.value)}>
          <option value="">All tools</option>
          {tools.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <div className="tb-spacer" />
        {sel.size > 0 && (
          <>
            <span className="tb-meta" style={{ color: 'var(--accent)' }}>{sel.size} selected</span>
            <button className="btn sm danger-ghost" onClick={onBulkDelete}>
              <Icon name="trash" /> Delete
            </button>
            <div style={{ width: 1, height: 20, background: 'var(--border)', margin: '0 4px' }} />
          </>
        )}
        <span className="tb-meta">{filtered.length} rules</span>
      </div>

      <div className="table-wrap">
        <div className="table-scroll">
          <table className="rules">
            <thead>
              <tr>
                <th className="col-check">
                  <input type="checkbox" className="cbx"
                         checked={pageRules.length > 0 && pageRules.every(r => sel.has(r.id))}
                         onChange={toggleAll} />
                </th>
                <th className="col-enabled">On</th>
                <th>Rule</th>
                <th>Condition</th>
                <th className="col-tool">Tool</th>
                <th className="col-updated">Updated</th>
                <th className="col-actions"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? <SkeletonRows count={5} cols={7} /> :
                pageRules.length === 0 ? (
                  <tr><td colSpan={7}><EmptyState icon="rules"
                    title={`No ${rt.name} rules yet`}
                    body="Create one to get started."
                    actions={
                      <button className="btn sm accent"
                              onClick={() => navigate(`/rules/${rt.slug}/new`)}>
                        <Icon name="plus" /> Create first rule
                      </button>
                    } />
                  </td></tr>
                ) :
                pageRules.map(r => (
                  <tr key={r.id} className={sel.has(r.id) ? 'selected' : ''}
                      onClick={() => navigate(`/rules/${rt.slug}/edit/${r.id}`)}>
                    <td className="col-check" onClick={e => e.stopPropagation()}>
                      <input type="checkbox" className="cbx"
                             checked={sel.has(r.id)} onChange={() => toggleSel(r.id)} />
                    </td>
                    <td className="col-enabled">
                      <Switch checked={r.enabled} onChange={() => toggleEnabled(r)} />
                    </td>
                    <td>
                      <div className="cell-name">{r.name}</div>
                      {r.description && <div className="cell-desc">{r.description}</div>}
                    </td>
                    <td>
                      <div className="cell-cond">
                        {r.condition_raw || <span className="muted">—</span>}
                      </div>
                    </td>
                    <td>{r.tool ? <span className="tool-badge">{r.tool}</span> : <span className="muted small">—</span>}</td>
                    <td><span className="muted small">{new Date(r.updated_at).toLocaleDateString()}</span></td>
                    <td className="col-actions" onClick={e => e.stopPropagation()}>
                      <div className="row-actions">
                        <button className="btn icon sm ghost" title="Edit"
                                onClick={() => navigate(`/rules/${rt.slug}/edit/${r.id}`)}>
                          <Icon name="edit" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        {!loading && filtered.length > PAGE_SIZE && (
          <div className="pager">
            <span>Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}</span>
            <div className="pager-ctrls">
              <button className="btn sm ghost" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Prev</button>
              <span className="small muted" style={{ padding: '0 8px' }}>{page + 1} / {totalPages}</span>
              <button className="btn sm ghost" disabled={page + 1 >= totalPages} onClick={() => setPage(p => p + 1)}>Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
