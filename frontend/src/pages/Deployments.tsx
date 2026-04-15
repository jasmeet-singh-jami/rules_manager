import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Client, Deployment, getClients, getDeployments, createDeployment, exportDeployment } from '../api/client'
import { useAuth } from '../context/AuthContext'

export function Deployments() {
  const { hasEditAccess } = useAuth()
  const { id: clientId } = useParams<{ id: string }>()
  const [client, setClient] = useState<Client | null>(null)
  const [deployments, setDeployments] = useState<Deployment[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ version: '', notes: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!clientId) return
    Promise.all([
      getClients().then(cs => cs.find(c => c.id === clientId) ?? null),
      getDeployments(clientId),
    ]).then(([c, deps]) => {
      setClient(c)
      setDeployments(deps)
    }).catch(() => {
      setError('Failed to load deployments')
    }).finally(() => setLoading(false))
  }, [clientId])

  async function handleCreate() {
    if (!form.version.trim()) { setError('Version is required'); return }
    setSaving(true); setError('')
    try {
      const dep = await createDeployment({ client_id: clientId!, version: form.version, notes: form.notes || undefined })
      setDeployments(prev => [dep, ...prev])
      setShowForm(false)
      setForm({ version: '', notes: '' })
    } catch { setError('Failed to create deployment') }
    finally { setSaving(false) }
  }

  async function handleDownload(dep: Deployment) {
    try {
      const res = await exportDeployment(dep.id)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `deployment_${dep.version}.zip`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      setError('Failed to download deployment ZIP')
    }
  }

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '20px 0 6px' }}>
        <div>
          <Link to="/clients" style={{ color: 'var(--accent)', fontSize: 13 }}>← Clients</Link>
          <h2 style={{ margin: '4px 0 0' }}>
            Deployments {client ? `— ${client.name}` : ''}
          </h2>
        </div>
        {hasEditAccess(clientId ?? '') && (
          <button className="btn-primary" onClick={() => setShowForm(true)}>+ New Deployment</button>
        )}
      </div>

      {showForm && (
        <div style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: 10, padding: 20, marginBottom: 16 }}>
          <h3 style={{ margin: '0 0 14px' }}>Create Deployment</h3>
          {error && <p className="error-msg">{error}</p>}
          <div className="form-grid">
            <div className="form-row">
              <label htmlFor="dep-version">Version</label>
              <input id="dep-version" placeholder="e.g. v1.2" value={form.version}
                onChange={e => setForm(f => ({ ...f, version: e.target.value }))} />
            </div>
            <div className="form-row">
              <label htmlFor="dep-notes">Release Notes</label>
              <input id="dep-notes" placeholder="Optional" value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          <div className="form-actions">
            <button className="btn-outline" onClick={() => setShowForm(false)}>Cancel</button>
            <button className="btn-primary" onClick={handleCreate} disabled={saving}>
              {saving ? 'Creating…' : 'Create & Snapshot Rules'}
            </button>
          </div>
        </div>
      )}

      {loading && <p className="muted">Loading…</p>}

      <div style={{ background: '#fff', borderRadius: 10, border: '1px solid var(--line)', overflow: 'hidden' }}>
        <table>
          <thead>
            <tr><th>Version</th><th>Status</th><th>Notes</th><th>Created</th><th>Export</th></tr>
          </thead>
          <tbody>
            {deployments.map(dep => (
              <tr key={dep.id}>
                <td><strong>{dep.version}</strong></td>
                <td><span className={`badge ${dep.status === 'deployed' ? 'badge-ok' : 'badge-muted'}`}>{dep.status}</span></td>
                <td className="muted">{dep.notes ?? '—'}</td>
                <td className="muted" style={{ fontSize: 12 }}>{new Date(dep.created_at).toLocaleString()}</td>
                <td>
                  <button className="btn-outline btn-sm" onClick={() => handleDownload(dep)}>
                    ↓ ZIP
                  </button>
                </td>
              </tr>
            ))}
            {!loading && deployments.length === 0 && (
              <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--muted)', padding: 24 }}>
                No deployments yet.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  )
}
