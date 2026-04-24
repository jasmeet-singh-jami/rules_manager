import { Fragment, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useClients } from '../context/ClientContext'
import { useAuth } from '../context/AuthContext'
import {
  copyRule,
  deleteRule,
  exportRules,
  getRuleTypes,
  getRules,
  updateRule,
  type RuleType,
  type Rule,
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
  const { hasEditAccess } = useAuth()
  const { clients, selectedClientId, setSelectedClientId, bumpRulesVersion } = useClients()

  const [ruleTypes, setRuleTypes] = useState<RuleType[]>([])
  const [rules, setRules] = useState<Rule[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingRuleTypes, setLoadingRuleTypes] = useState(true)
  const [q, setQ] = useState('')
  const [tool, setTool] = useState<string>('')
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [expandedRuleIds, setExpandedRuleIds] = useState<Set<string>>(new Set())
  const [page, setPage] = useState(0)
  const [exporting, setExporting] = useState(false)
  const [copying, setCopying] = useState(false)
  const [copySourceRule, setCopySourceRule] = useState<Rule | null>(null)
  const [copyTargetClientId, setCopyTargetClientId] = useState('')

  const rt = ruleTypes.find(ruleType => ruleType.slug === slug)

  useEffect(() => {
    getRuleTypes()
      .then(setRuleTypes)
      .catch(() => {})
      .finally(() => setLoadingRuleTypes(false))
  }, [])

  useEffect(() => {
    if (!rt) return
    let cancelled = false
    setLoading(true)
    setSel(new Set())
    setExpandedRuleIds(new Set())
    setPage(0)
    getRules({ client_id: selectedClientId ?? undefined, rule_type: rt.slug })
      .then(data => {
        if (!cancelled) setRules(data)
      })
      .catch(() => {
        if (!cancelled) setRules([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [rt?.slug, selectedClientId])

  useEffect(() => {
    setPage(0)
  }, [q, tool])

  const clientNameById = useMemo(
    () => new Map(clients.map(client => [client.id, client])),
    [clients],
  )

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase()
    return rules.filter(rule =>
      (!tool || rule.tool === tool) &&
      (!ql || rule.name.toLowerCase().includes(ql) ||
        (rule.description ?? '').toLowerCase().includes(ql) ||
        (rule.condition_raw ?? '').toLowerCase().includes(ql) ||
        (rule.action_raw ?? '').toLowerCase().includes(ql) ||
        (clientNameById.get(rule.client_id)?.name ?? '').toLowerCase().includes(ql))
    )
  }, [rules, q, tool, clientNameById])

  const pageRules = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const enabledCount = rules.filter(rule => rule.enabled).length
  const tools = Array.from(new Set(rules.map(rule => rule.tool).filter(Boolean))) as string[]
  const selectedRules = filtered.filter(rule => sel.has(rule.id))
  const selectedEditableCount = selectedRules.filter(rule => hasEditAccess(rule.client_id)).length
  const writableCopyTargets = clients.filter(client => hasEditAccess(client.id))

  const toggleExpanded = (ruleId: string) => {
    setExpandedRuleIds(prev => {
      const next = new Set(prev)
      if (next.has(ruleId)) next.delete(ruleId)
      else next.add(ruleId)
      return next
    })
  }

  const toggleEnabled = async (rule: Rule) => {
    if (!hasEditAccess(rule.client_id)) return
    const next = !rule.enabled
    setRules(prev => prev.map(current => current.id === rule.id ? { ...current, enabled: next } : current))
    try {
      await updateRule(rule.id, { enabled: next })
      toast(next ? 'Rule enabled' : 'Rule disabled', 'ok')
    } catch {
      setRules(prev => prev.map(current => current.id === rule.id ? { ...current, enabled: !next } : current))
      toast('Failed to update rule', 'danger')
    }
  }

  const toggleSel = (id: string) => {
    setSel(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    setSel(prev =>
      pageRules.length > 0 && pageRules.every(rule => prev.has(rule.id))
        ? new Set()
        : new Set(pageRules.map(rule => rule.id)),
    )
  }

  const onBulkDelete = async () => {
    if (sel.size === 0) return
    if (selectedEditableCount !== selectedRules.length) {
      toast('You can only delete rules for clients you can edit', 'warn')
      return
    }
    if (!confirm(`Delete ${sel.size} rule(s)?`)) return
    try {
      await Promise.all(Array.from(sel).map(id => deleteRule(id)))
      setRules(prev => prev.filter(rule => !sel.has(rule.id)))
      setSel(new Set())
      setExpandedRuleIds(prev => new Set(Array.from(prev).filter(id => !sel.has(id))))
      bumpRulesVersion()
      toast('Rules deleted', 'ok')
    } catch {
      toast('Failed to delete rules', 'danger')
    }
  }

  const onDeleteRule = async (rule: Rule) => {
    if (!hasEditAccess(rule.client_id)) return
    if (!confirm(`Delete "${rule.name}"?`)) return
    try {
      await deleteRule(rule.id)
      setRules(prev => prev.filter(current => current.id !== rule.id))
      setSel(prev => { const next = new Set(prev); next.delete(rule.id); return next })
      setExpandedRuleIds(prev => { const next = new Set(prev); next.delete(rule.id); return next })
      bumpRulesVersion()
      toast('Rule deleted', 'ok')
    } catch {
      toast('Failed to delete rule', 'danger')
    }
  }

  const onExportSelected = async () => {
    if (sel.size === 0) return
    setExporting(true)
    try {
      const response = await exportRules(Array.from(sel))
      if (!response.ok) throw new Error('Export failed')
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = rt ? `${rt.slug}-rules.zip` : 'rules-export.zip'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      toast('Rules exported', 'ok')
    } catch {
      toast('Failed to export selected rules', 'danger')
    } finally {
      setExporting(false)
    }
  }

  const openCopyModal = (rule: Rule) => {
    setCopySourceRule(rule)
    setCopyTargetClientId('')
  }

  const closeCopyModal = () => {
    setCopySourceRule(null)
    setCopyTargetClientId('')
  }

  const onCopyRule = async () => {
    if (!copySourceRule || !copyTargetClientId) return
    setCopying(true)
    try {
      const copiedRule = await copyRule(copySourceRule.id, copyTargetClientId)
      if (copiedRule.rule_type_id === rt?.id && (!selectedClientId || copiedRule.client_id === selectedClientId)) {
        setRules(prev => [copiedRule, ...prev])
      }
      bumpRulesVersion()
      toast('Rule copied', 'ok')
      closeCopyModal()
    } catch {
      toast('Failed to copy rule', 'danger')
    } finally {
      setCopying(false)
    }
  }

  const startNewRule = () => {
    if (!rt || !selectedClientId) return
    navigate(`/rules/${rt.slug}/new`)
  }

  const openImportForRuleType = () => {
    if (!rt) return
    const params = new URLSearchParams({ rule_type: rt.slug })
    if (selectedClientId) params.set('client_id', selectedClientId)
    navigate(`/import?${params.toString()}`)
  }

  const editRule = (rule: Rule) => {
    if (!rt || !hasEditAccess(rule.client_id)) return
    setSelectedClientId(rule.client_id)
    navigate(`/rules/${rt.slug}/edit/${rule.id}`)
  }

  if (loadingRuleTypes) return <div className="page"><div className="empty">Loading...</div></div>
  if (!rt) return <div className="page"><div className="empty">Rule type not found</div></div>

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">{rt.name}</h1>
          <div className="page-sub">
            {enabledCount} of {rules.length} enabled
          </div>
        </div>
        <div className="page-actions">
          <button className="btn sm ghost" onClick={openImportForRuleType}>
            <Icon name="import" /> Import DRL
          </button>
          <button
            className="btn sm accent"
            onClick={startNewRule}
            disabled={!selectedClientId || !hasEditAccess(selectedClientId)}
            title={selectedClientId ? undefined : 'Pick a client to create a new rule'}
          >
            <Icon name="plus" /> New rule
          </button>
        </div>
      </div>

      <div className="toolbar">
        <div className="tb-input">
          <Icon name="search" />
          <input value={q} onChange={e => setQ(e.target.value)}
                 placeholder={`Search ${rt.name.toLowerCase()}...`} />
        </div>
        <select
          className="select"
          value={selectedClientId ?? ''}
          onChange={e => setSelectedClientId(e.target.value || null)}
          aria-label="Client filter"
        >
          <option value="">All clients</option>
          {clients.map(client => (
            <option key={client.id} value={client.id}>{client.name}</option>
          ))}
        </select>
        <select className="select" value={tool} onChange={e => setTool(e.target.value)}>
          <option value="">All tools</option>
          {tools.map(value => <option key={value} value={value}>{value}</option>)}
        </select>
        <div className="tb-spacer" />
        {sel.size > 0 && (
          <>
            <span className="tb-meta" style={{ color: 'var(--accent)' }}>{sel.size} selected</span>
            <button className="btn sm ghost" onClick={onExportSelected} disabled={exporting}>
              <Icon name="download" /> {exporting ? 'Exporting...' : 'Export'}
            </button>
            <button
              className="btn sm danger-ghost"
              onClick={onBulkDelete}
              disabled={selectedEditableCount !== selectedRules.length}
              title={selectedEditableCount !== selectedRules.length ? 'Delete is only available for rules you can edit' : undefined}
            >
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
                         checked={pageRules.length > 0 && pageRules.every(rule => sel.has(rule.id))}
                         onChange={toggleAll} />
                </th>
                <th className="col-enabled">On</th>
                <th>Rule</th>
                <th>Description</th>
                <th>Client</th>
                <th className="col-tool">Tool</th>
                <th className="col-updated">Updated</th>
                <th className="col-actions"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? <SkeletonRows count={5} cols={8} /> :
                pageRules.length === 0 ? (
                  <tr><td colSpan={8}><EmptyState icon="rules"
                    title={`No ${rt.name} rules yet`}
                    body={selectedClientId ? 'Create one to get started for this client.' : 'Try another client filter or create a rule for a specific client.'}
                    actions={
                      selectedClientId && hasEditAccess(selectedClientId) ? (
                        <button className="btn sm accent" onClick={startNewRule}>
                          <Icon name="plus" /> Create first rule
                        </button>
                      ) : undefined
                    } />
                  </td></tr>
                ) :
                pageRules.map(rule => {
                  const client = clientNameById.get(rule.client_id)
                  const canEdit = hasEditAccess(rule.client_id)
                  const hasCopyTarget = writableCopyTargets.some(target => target.id !== rule.client_id)
                  const isExpanded = expandedRuleIds.has(rule.id)
                  return (
                    <Fragment key={rule.id}>
                      <tr
                        className={sel.has(rule.id) ? 'selected' : ''}
                        onClick={() => toggleExpanded(rule.id)}
                      >
                        <td className="col-check" onClick={event => event.stopPropagation()}>
                          <input
                            type="checkbox"
                            className="cbx"
                            checked={sel.has(rule.id)}
                            onChange={() => toggleSel(rule.id)}
                          />
                        </td>
                        <td className="col-enabled" onClick={event => event.stopPropagation()}>
                          <Switch
                            checked={rule.enabled}
                            onChange={() => {
                              if (canEdit) void toggleEnabled(rule)
                            }}
                            title={canEdit ? 'Toggle rule' : 'You can only edit rules for clients you can access'}
                          />
                        </td>
                        <td>
                          <div className="rule-cell">
                            <button
                              className="btn icon sm ghost rule-expand"
                              type="button"
                              aria-label={isExpanded ? `Collapse ${rule.name}` : `Expand ${rule.name}`}
                              aria-expanded={isExpanded}
                              onClick={event => {
                                event.stopPropagation()
                                toggleExpanded(rule.id)
                              }}
                            >
                              <Icon name={isExpanded ? 'chevD' : 'chevR'} size={14} />
                            </button>
                            <div className="cell-name">{rule.name}</div>
                          </div>
                        </td>
                        <td>
                          {rule.description
                            ? <span className="cell-desc" style={{ display: 'block' }}>{rule.description}</span>
                            : <span className="muted small">—</span>}
                        </td>
                        <td>
                          <div className="cell-name">{client?.name ?? 'Unknown client'}</div>
                          <div className="muted small">{client?.code ?? rule.client_id}</div>
                        </td>
                        <td>{rule.tool ? <span className="tool-badge">{rule.tool}</span> : <span className="muted small">-</span>}</td>
                        <td><span className="muted small">{new Date(rule.updated_at).toLocaleDateString()}</span></td>
                        <td className="col-actions" onClick={event => event.stopPropagation()}>
                          <div className="row-actions">
                            {canEdit && (
                              <button className="btn icon sm ghost" title="Edit"
                                      onClick={() => editRule(rule)}>
                                <Icon name="edit" />
                              </button>
                            )}
                            {hasCopyTarget && (
                              <button className="btn icon sm ghost" title="Copy"
                                      onClick={() => openCopyModal(rule)}>
                                <Icon name="copy" />
                              </button>
                            )}
                            {canEdit && (
                              <button className="btn icon sm danger-ghost" title="Delete"
                                      onClick={() => { void onDeleteRule(rule) }}>
                                <Icon name="trash" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="rule-expanded">
                          <td colSpan={8}>
                            <div className="rule-expanded-cell">
                              <div className="rule-detail-grid">
                                <div className="rule-detail-block">
                                  <div className="rule-detail-label">Condition</div>
                                  <pre className="rule-detail-code">{rule.condition_raw || '- not set -'}</pre>
                                </div>
                                <div className="rule-detail-block">
                                  <div className="rule-detail-label">Action</div>
                                  <pre className="rule-detail-code">{rule.action_raw || '- not set -'}</pre>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
            </tbody>
          </table>
        </div>
        {!loading && filtered.length > PAGE_SIZE && (
          <div className="pager">
            <span>Showing {page * PAGE_SIZE + 1}-{Math.min((page + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}</span>
            <div className="pager-ctrls">
              <button className="btn sm ghost" disabled={page === 0} onClick={() => setPage(current => current - 1)}>Prev</button>
              <span className="small muted" style={{ padding: '0 8px' }}>{page + 1} / {totalPages}</span>
              <button className="btn sm ghost" disabled={page + 1 >= totalPages} onClick={() => setPage(current => current + 1)}>Next</button>
            </div>
          </div>
        )}
      </div>

      {copySourceRule && (
        <div className="modal-backdrop" onClick={closeCopyModal}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Copy Rule</h2>
            <div className="field" style={{ marginBottom: 12 }}>
              <label>Rule</label>
              <input value={copySourceRule.name} readOnly />
            </div>
            <div className="field" style={{ marginBottom: 20 }}>
              <label htmlFor="copy-target-client">Target client</label>
              <select
                id="copy-target-client"
                value={copyTargetClientId}
                onChange={e => setCopyTargetClientId(e.target.value)}
              >
                <option value="">Choose client...</option>
                {writableCopyTargets
                  .filter(client => client.id !== copySourceRule.client_id)
                  .map(client => (
                    <option key={client.id} value={client.id}>{client.name}</option>
                  ))}
              </select>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn ghost" onClick={closeCopyModal}>Cancel</button>
              <button className="btn accent" onClick={onCopyRule} disabled={!copyTargetClientId || copying}>
                {copying ? 'Copying...' : 'Copy rule'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
