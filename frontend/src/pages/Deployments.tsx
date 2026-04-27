import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { getClients, getDeployments, createDeployment, exportDeployment, type Client, type Deployment } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { SkeletonRows } from '../components/Skeleton'
import { EmptyState } from '../components/EmptyState'
import { Icon } from '../components/Icon'
import { useToast } from '../components/Toast'

type Row = Deployment & { client_code: string; client_name: string }

interface DeployForm { version: string; notes: string; client_id: string }

export function Deployments() {
  const { id: scopedClientId } = useParams<{ id?: string }>()
  const global = !scopedClientId
  const { hasEditAccess } = useAuth()
  const { toast } = useToast()

  const [clients, setClients] = useState<Client[]>([])
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [clientFilter, setClientFilter] = useState<string>('')
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState<DeployForm>({ version: '', notes: '', client_id: '' })
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  useEffect(() => {
    let cancel = false
    setLoading(true)
    getClients()
      .then(async cs => {
        if (cancel) return
        setClients(cs)
        const scope = scopedClientId ? cs.filter(c => c.id === scopedClientId) : cs
        const all = await Promise.all(scope.map(async c => {
          const deps = await getDeployments(c.id).catch(() => [])
          return deps.map(d => ({ ...d, client_code: c.code, client_name: c.name }))
        }))
        if (cancel) return
        const flat = all.flat().sort((a, b) => b.created_at.localeCompare(a.created_at))
        setRows(flat)
      })
      .finally(() => !cancel && setLoading(false))
    return () => { cancel = true }
  }, [scopedClientId])

  const openModal = () => { setForm({ version: '', notes: '', client_id: scopedClientId ?? '' }); setFormError(''); setShowModal(true) }
  const closeModal = () => setShowModal(false)

  const handleCreate = async () => {
    if (!form.version.trim()) { setFormError('Version is required'); return }
    const targetClientId = form.client_id || scopedClientId
    if (!targetClientId) { setFormError('Client is required'); return }
    setSaving(true)
    setFormError('')
    try {
      const dep = await createDeployment({ client_id: targetClientId, version: form.version.trim(), notes: form.notes.trim() || undefined })
      const client = clients.find(c => c.id === targetClientId)
      setRows(prev => [{ ...dep, client_code: client?.code ?? '', client_name: client?.name ?? '' }, ...prev])
      toast('Deployment created', 'ok')
      closeModal()
    } catch {
      setFormError('Failed to create deployment — version may already exist')
    } finally {
      setSaving(false)
    }
  }

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase()
    return rows.filter(r =>
      (!clientFilter || r.client_id === clientFilter) &&
      (!ql || r.version.toLowerCase().includes(ql) ||
              (r.notes ?? '').toLowerCase().includes(ql) ||
              r.client_code.toLowerCase().includes(ql))
    )
  }, [rows, q, clientFilter])

  const handleDownload = async (dep: Row) => {
    try {
      const res = await exportDeployment(dep.id)
      if (!res.ok) { toast('Download failed', 'danger'); return }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `deployment_${dep.version}.zip`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast('Download failed', 'danger')
    }
  }

  const scopedClient = clients.find(c => c.id === scopedClientId)

  const accessibleClients = clients.filter(c => hasEditAccess(c.id))
  const canCreateDeployment = global
    ? accessibleClients.length > 0
    : !!scopedClientId && hasEditAccess(scopedClientId)

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">{global ? 'Deployments' : `Deployments · ${scopedClient?.code ?? ''}`}</h1>
          <div className="page-sub">
            {global ? 'History across all clients' : 'Per-client deployment history'}
          </div>
        </div>
        {canCreateDeployment && (
          <div className="page-actions">
            <button className="btn accent" onClick={openModal}>
              <Icon name="plus" /> New Deployment
            </button>
          </div>
        )}
      </div>

      <div className="toolbar">
        <div className="tb-input">
          <Icon name="search" />
          <input value={q} onChange={e => setQ(e.target.value)}
                 placeholder="Search deployments…" />
        </div>
        {global && (
          <select className="select" value={clientFilter}
                  onChange={e => setClientFilter(e.target.value)}>
            <option value="">All clients</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.code}</option>)}
          </select>
        )}
        <div className="tb-spacer" />
        <span className="tb-meta">{filtered.length} deployments</span>
      </div>

      <div className="table-wrap">
        <table className="rules">
          <thead>
            <tr>
              <th className="col-id">Version</th>
              {global && <th>Client</th>}
              <th>Notes</th>
              <th className="col-updated">Created</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {loading ? <SkeletonRows count={5} cols={global ? 5 : 4} /> :
              filtered.length === 0 ? (
                <tr><td colSpan={global ? 5 : 4}>
                  <EmptyState icon="deploy" title="No deployments yet"
                    body="" />
                </td></tr>
              ) : filtered.map(r => (
                <tr key={r.id}>
                  <td><span className="cell-id">{r.version}</span></td>
                  {global && <td className="cell-name">{r.client_code}</td>}
                  <td className="small">{r.notes ?? <span className="muted">—</span>}</td>
                  <td><span className="muted small">{new Date(r.created_at).toLocaleString()}</span></td>
                  <td>
                    <button className="btn ghost icon-only" title="Download DRL bundle" onClick={() => handleDownload(r)}>
                      <Icon name="download" />
                    </button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-backdrop" onClick={closeModal}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>New Deployment</h2>
            {formError && <div className="callout danger small" style={{ marginBottom: 14 }}>{formError}</div>}
            {global && (
              <div className="field" style={{ marginBottom: 12 }}>
                <label htmlFor="dep-client">Client</label>
                <select
                  id="dep-client"
                  className="select"
                  value={form.client_id}
                  onChange={e => setForm(f => ({ ...f, client_id: e.target.value }))}
                >
                  <option value="">Select a client…</option>
                  {accessibleClients.map(c => (
                    <option key={c.id} value={c.id}>{c.code} — {c.name}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="field" style={{ marginBottom: 12 }}>
              <label htmlFor="dep-version">Version</label>
              <input
                id="dep-version"
                type="text"
                placeholder="e.g. 1.0.0"
                value={form.version}
                onChange={e => setForm(f => ({ ...f, version: e.target.value }))}
              />
            </div>
            <div className="field" style={{ marginBottom: 20 }}>
              <label htmlFor="dep-notes">Notes</label>
              <input
                id="dep-notes"
                type="text"
                placeholder="Optional release notes"
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn ghost" onClick={closeModal}>Cancel</button>
              <button className="btn accent" onClick={handleCreate} disabled={saving}>
                {saving ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
