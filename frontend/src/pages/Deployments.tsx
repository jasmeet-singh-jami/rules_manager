import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { getClients, getDeployments, type Client, type Deployment } from '../api/client'
import { SkeletonRows } from '../components/Skeleton'
import { EmptyState } from '../components/EmptyState'
import { Icon } from '../components/Icon'

type Row = Deployment & { client_code: string; client_name: string }

export function Deployments() {
  const { id: scopedClientId } = useParams<{ id?: string }>()
  const global = !scopedClientId

  const [clients, setClients] = useState<Client[]>([])
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [statusFilter, setStatusFilter] = useState<'' | Deployment['status']>('')
  const [clientFilter, setClientFilter] = useState<string>('')

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

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase()
    return rows.filter(r =>
      (!statusFilter || r.status === statusFilter) &&
      (!clientFilter || r.client_id === clientFilter) &&
      (!ql || r.version.toLowerCase().includes(ql) ||
              (r.notes ?? '').toLowerCase().includes(ql) ||
              r.client_code.toLowerCase().includes(ql))
    )
  }, [rows, q, statusFilter, clientFilter])

  const scopedClient = clients.find(c => c.id === scopedClientId)

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">{global ? 'Deployments' : `Deployments · ${scopedClient?.code ?? ''}`}</h1>
          <div className="page-sub">
            {global ? 'History across all clients' : 'Per-client deployment history'}
          </div>
        </div>
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
        <select className="select" value={statusFilter}
                onChange={e => setStatusFilter(e.target.value as '' | Deployment['status'])}>
          <option value="">All statuses</option>
          <option value="draft">Draft</option>
          <option value="deployed">Deployed</option>
        </select>
        <div className="tb-spacer" />
        <span className="tb-meta">{filtered.length} deployments</span>
      </div>

      <div className="table-wrap">
        <table className="rules">
          <thead>
            <tr>
              <th className="col-id">Version</th>
              {global && <th>Client</th>}
              <th>Status</th>
              <th>Notes</th>
              <th className="col-updated">Created</th>
            </tr>
          </thead>
          <tbody>
            {loading ? <SkeletonRows count={5} cols={global ? 5 : 4} /> :
              filtered.length === 0 ? (
                <tr><td colSpan={global ? 5 : 4}>
                  <EmptyState icon="deploy" title="No deployments yet"
                    body={global ? 'Create a deployment from a client page.' : ''} />
                </td></tr>
              ) : filtered.map(r => (
                <tr key={r.id}>
                  <td><span className="cell-id">{r.version}</span></td>
                  {global && <td className="cell-name">{r.client_code}</td>}
                  <td>
                    <span className={`badge ${r.status === 'deployed' ? 'ok' : 'warn'}`}>
                      <span className="dot" /> {r.status}
                    </span>
                  </td>
                  <td className="small">{r.notes ?? <span className="muted">—</span>}</td>
                  <td><span className="muted small">{new Date(r.created_at).toLocaleString()}</span></td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
