import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Client, getClients, createClient, updateClient, deleteClient } from '../api/client'

interface FormState { code: string; name: string; description: string }
const empty: FormState = { code: '', name: '', description: '' }

export function Clients() {
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
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '20px 0 16px' }}>
        <h2 style={{ margin: 0 }}>Clients</h2>
        <button className="btn-primary" onClick={openNew}>+ New Client</button>
      </div>

      {loading && <p className="muted">Loading…</p>}

      <div style={{ background: '#fff', borderRadius: 10, border: '1px solid var(--line)', overflow: 'hidden' }}>
        <table>
          <thead>
            <tr><th>Code</th><th>Name</th><th>Description</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {clients.map(c => (
              <tr key={c.id}>
                <td><strong>{c.code}</strong></td>
                <td>{c.name}</td>
                <td className="muted">{c.description ?? '—'}</td>
                <td>
                  <span style={{ display: 'flex', gap: 6 }}>
                    <Link to={`/clients/${c.id}/deployments`}>
                      <button className="btn-outline btn-sm">Deployments</button>
                    </Link>
                    <button className="btn-outline btn-sm" onClick={() => openEdit(c)}>Edit</button>
                    <button className="btn-danger btn-sm" onClick={() => handleDelete(c)}>Delete</button>
                  </span>
                </td>
              </tr>
            ))}
            {!loading && clients.length === 0 && (
              <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--muted)', padding: 24 }}>
                No clients yet. Click "+ New Client" to add one.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {modal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>{modal === 'new' ? 'New Client' : `Edit: ${(modal as Client).name}`}</h2>
            {error && <p className="error-msg">{error}</p>}
            <div className="form-row">
              <label htmlFor="client-code">Client Code</label>
              <input
                id="client-code"
                placeholder="e.g. INFY"
                value={form.code}
                disabled={modal !== 'new'}
                onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
              />
            </div>
            <div className="form-row">
              <label htmlFor="client-name">Name</label>
              <input
                id="client-name"
                placeholder="Display name"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="form-row">
              <label htmlFor="client-desc">Description</label>
              <input
                id="client-desc"
                placeholder="Optional"
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div className="form-actions">
              <button className="btn-outline" onClick={closeModal}>Cancel</button>
              <button className="btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
