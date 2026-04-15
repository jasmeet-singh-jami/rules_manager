import { useEffect, useState } from 'react'
import { getClients, Client } from '../api/client'
import { useAuth } from '../context/AuthContext'

interface UserWithClients {
  id: string
  username: string
  role: string
  client_ids: string[]
}

async function listUsers(token: string): Promise<UserWithClients[]> {
  const res = await fetch('/api/admin/users', {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error('Failed to load users')
  return res.json()
}

async function grantAccess(userId: string, clientId: string, token: string): Promise<void> {
  const res = await fetch(`/api/admin/users/${userId}/clients/${clientId}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error('Failed to grant access')
}

async function revokeAccess(userId: string, clientId: string, token: string): Promise<void> {
  const res = await fetch(`/api/admin/users/${userId}/clients/${clientId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error('Failed to revoke access')
}

export function AdminPage() {
  const { token: authToken } = useAuth()
  const token = authToken ?? ''
  const [users, setUsers] = useState<UserWithClients[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([listUsers(token), getClients()])
      .then(([u, c]) => { setUsers(u); setClients(c) })
      .catch(() => setError('Failed to load data'))
      .finally(() => setLoading(false))
  }, [])

  async function handleGrant(userId: string, clientId: string) {
    try {
      await grantAccess(userId, clientId, token)
      setUsers(prev => prev.map(u =>
        u.id === userId && !u.client_ids.includes(clientId)
          ? { ...u, client_ids: [...u.client_ids, clientId] }
          : u
      ))
    } catch {
      setError('Failed to grant access')
    }
  }

  async function handleRevoke(userId: string, clientId: string) {
    try {
      await revokeAccess(userId, clientId, token)
      setUsers(prev => prev.map(u =>
        u.id === userId
          ? { ...u, client_ids: u.client_ids.filter(id => id !== clientId) }
          : u
      ))
    } catch {
      setError('Failed to revoke access')
    }
  }

  if (loading) return <p className="muted" style={{ margin: '24px 0' }}>Loading…</p>
  if (error) return <p className="error-msg" style={{ margin: '24px 0' }}>{error}</p>

  const clientMap = Object.fromEntries(clients.map(c => [c.id, c]))

  return (
    <>
      <h2 style={{ margin: '20px 0 16px' }}>User Management</h2>
      <div style={{ background: '#fff', borderRadius: 10, border: '1px solid var(--line)', overflow: 'hidden' }}>
        <table>
          <thead>
            <tr>
              <th>Username</th>
              <th>Role</th>
              <th>Client Access</th>
              <th>Grant Access</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id}>
                <td><strong>{u.username}</strong></td>
                <td style={{ textTransform: 'capitalize' }}>{u.role}</td>
                <td>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {u.client_ids.length === 0 && <span className="muted">None</span>}
                    {u.client_ids.map(cid => (
                      <span key={cid} style={{
                        background: '#e8f0fe', borderRadius: 4,
                        padding: '2px 8px', fontSize: 12, display: 'flex', gap: 4, alignItems: 'center'
                      }}>
                        {clientMap[cid]?.code ?? cid.slice(0, 8)}
                        <button
                          onClick={() => handleRevoke(u.id, cid)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#c00', padding: 0, fontSize: 14, lineHeight: 1 }}
                          title="Revoke access"
                        >×</button>
                      </span>
                    ))}
                  </div>
                </td>
                <td>
                  <select
                    defaultValue=""
                    onChange={e => {
                      if (e.target.value) { handleGrant(u.id, e.target.value); e.target.value = '' }
                    }}
                    style={{ fontSize: 12, padding: '3px 6px' }}
                  >
                    <option value="">Add client…</option>
                    {clients
                      .filter(c => !u.client_ids.includes(c.id))
                      .map(c => (
                        <option key={c.id} value={c.id}>{c.code} — {c.name}</option>
                      ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
