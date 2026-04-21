import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Client, getClients, createClient, updateClient, deleteClient } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { EmptyState } from '../components/EmptyState'

interface FormState { code: string; name: string; description: string }
const empty: FormState = { code: '', name: '', description: '' }

export function Clients() {
  const { hasEditAccess, addClientAccess, isAdmin } = useAuth()
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [modal, setModal] = useState<'new' | Client | null>(null)
  const [form, setForm] = useState<FormState>(empty)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getClients()
      .then(setClients)
      .catch(() => setError('Failed to load clients'))
      .finally(() => setLoading(false))
  }, [])

  function openNew() { setForm(empty); setModal('new') }
  function openEdit(c: Client) {
    setForm({ code: c.code, name: c.name, description: c.description ?? '' })
    setModal(c)
  }
  function closeModal() { setModal(null); setError('') }

  async function handleSave() {
    setSaving(true)
    setError('')
    try {
      if (modal === 'new') {
        const c = await createClient(form)
        setClients(prev => [...prev, c])
        if (!isAdmin) addClientAccess(c.id)
      } else if (modal) {
        const c = await updateClient((modal as Client).id, { name: form.name, description: form.description })
        setClients(prev => prev.map(x => x.id === c.id ? c : x))
      }
      closeModal()
    } catch {
      setError('Save failed — check that the client code is unique')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(c: Client) {
    if (!confirm(`Delete client "${c.name}"? This removes all their rules.`)) return
    await deleteClient(c.id)
    setClients(prev => prev.filter(x => x.id !== c.id))
  }

  return (
    <div className="page">
      <div className="page-head">
        <h1 className="page-title">Clients</h1>
        <div className="page-actions">
          <button className="btn accent" onClick={openNew}>+ New Client</button>
        </div>
      </div>

      {loading && <p className="muted">Loading…</p>}

      <div className="table-wrap">
        <table className="rules">
          <thead>
            <tr>
              <th>Code</th>
              <th>Name</th>
              <th>Description</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {clients.map(c => (
              <tr key={c.id}>
                <td className="cell-id"><strong>{c.code}</strong></td>
                <td className="cell-name">{c.name}</td>
                <td className="muted">{c.description ?? '—'}</td>
                <td>
                  <span style={{ display: 'flex', gap: 6 }}>
                    <Link to={`/clients/${c.id}/deployments`}>
                      <button className="btn sm ghost">Deployments</button>
                    </Link>
                    {hasEditAccess(c.id) && (
                      <button className="btn sm ghost" onClick={() => openEdit(c)}>Edit</button>
                    )}
                    {hasEditAccess(c.id) && (
                      <button className="btn sm danger-ghost" onClick={() => handleDelete(c)}>Delete</button>
                    )}
                  </span>
                </td>
              </tr>
            ))}
            {!loading && clients.length === 0 && (
              <tr>
                <td colSpan={4} style={{ padding: 0 }}>
                  <EmptyState
                    icon="folder"
                    title="No clients yet"
                    body='Click "+ New Client" to add one.'
                    actions={<button className="btn accent" onClick={openNew}>+ New Client</button>}
                  />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {modal && (
        <div className="modal-backdrop" onClick={closeModal}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>{modal === 'new' ? 'New Client' : `Edit: ${(modal as Client).name}`}</h2>
            {error && <div className="callout danger small" style={{ marginBottom: 14 }}>{error}</div>}
            <div className="field" style={{ marginBottom: 12 }}>
              <label htmlFor="client-code">Client Code</label>
              <input
                id="client-code"
                type="text"
                placeholder="e.g. INFY"
                value={form.code}
                disabled={modal !== 'new'}
                onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
              />
            </div>
            <div className="field" style={{ marginBottom: 12 }}>
              <label htmlFor="client-name">Name</label>
              <input
                id="client-name"
                type="text"
                placeholder="Display name"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="field" style={{ marginBottom: 20 }}>
              <label htmlFor="client-desc">Description</label>
              <input
                id="client-desc"
                type="text"
                placeholder="Optional"
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn ghost" onClick={closeModal}>Cancel</button>
              <button className="btn accent" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
