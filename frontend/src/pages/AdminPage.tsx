import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { getClients, type Client } from '../api/client'
import { Icon } from '../components/Icon'
import { useToast } from '../components/Toast'
import { PasswordStrength, scorePassword } from './Admin/PasswordStrength'

interface AdminUser {
  id: string
  username: string
  role: 'admin' | 'contributor'
  client_ids: string[]
}

async function listUsers(token: string): Promise<AdminUser[]> {
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

async function resetPassword(userId: string, token: string, newPw: string): Promise<void> {
  const res = await fetch(`/api/admin/users/${userId}/password`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ new_password: newPw }),
  })
  if (!res.ok) throw new Error('Reset failed')
}

export function AdminPage() {
  const { toast } = useToast()
  const { token: authToken } = useAuth()
  const token = authToken ?? ''

  const [users, setUsers] = useState<AdminUser[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [resetFor, setResetFor] = useState<AdminUser | null>(null)
  const [newPw, setNewPw] = useState('')

  useEffect(() => {
    listUsers(token).then(setUsers).catch(() => toast('Failed to load users', 'danger'))
    getClients().then(setClients).catch(() => {})
  }, [token])

  const onToggleAccess = async (user: AdminUser, clientId: string, grant: boolean) => {
    try {
      if (grant) await grantAccess(user.id, clientId, token)
      else       await revokeAccess(user.id, clientId, token)
      setUsers(prev => prev.map(u => u.id === user.id
        ? { ...u, client_ids: grant
            ? [...u.client_ids, clientId]
            : u.client_ids.filter(x => x !== clientId) }
        : u))
      toast(grant ? 'Access granted' : 'Access revoked', 'ok')
    } catch {
      toast('Failed', 'danger')
    }
  }

  const onResetConfirm = async () => {
    if (!resetFor) return
    const { score } = scorePassword(newPw)
    if (score < 3) { toast('Password is too weak', 'warn'); return }
    try {
      await resetPassword(resetFor.id, token, newPw)
      toast('Password reset', 'ok')
      setResetFor(null); setNewPw('')
    } catch {
      toast('Reset failed', 'danger')
    }
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Admin</h1>
          <div className="page-sub">Manage users and per-client access</div>
        </div>
      </div>

      {/* Users card */}
      <div className="card" style={{ padding: 0, marginBottom: 16 }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)',
                      fontSize: 13, fontWeight: 600 }}>Users</div>
        <table className="rules">
          <thead>
            <tr>
              <th>Username</th>
              <th>Role</th>
              <th className="col-actions"></th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id}>
                <td className="cell-name">{u.username}</td>
                <td>
                  <span className={`badge ${u.role === 'admin' ? 'accent' : 'neutral'}`}>{u.role}</span>
                </td>
                <td className="col-actions">
                  <button className="btn sm ghost" onClick={() => setResetFor(u)}>
                    <Icon name="shield" /> Reset password
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Access matrix card */}
      <div className="card" style={{ padding: 0 }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)',
                      fontSize: 13, fontWeight: 600 }}>Client Access</div>
        <div className="table-scroll">
          <table className="rules">
            <thead>
              <tr>
                <th>User</th>
                {clients.map(c => <th key={c.id} style={{ textAlign: 'center' }}>{c.code}</th>)}
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id}>
                  <td className="cell-name">{u.username}</td>
                  {clients.map(c => {
                    const checked = u.role === 'admin' || u.client_ids.includes(c.id)
                    return (
                      <td key={c.id} style={{ textAlign: 'center' }}>
                        <input type="checkbox" className="cbx"
                               checked={checked}
                               disabled={u.role === 'admin'}
                               onChange={() => onToggleAccess(u, c.id, !checked)} />
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Reset password dialog */}
      {resetFor && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
                      display: 'grid', placeItems: 'center', zIndex: 300 }}>
          <div className="card" style={{ width: 380 }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
              Reset password for {resetFor.username}
            </div>
            <div className="field">
              <label>New password</label>
              <input type="password" value={newPw} onChange={e => setNewPw(e.target.value)}
                     placeholder="At least 8 chars with digit and special" />
              <PasswordStrength value={newPw} />
            </div>
            <div className="hstack" style={{ justifyContent: 'flex-end', marginTop: 12 }}>
              <button className="btn sm ghost" onClick={() => { setResetFor(null); setNewPw('') }}>Cancel</button>
              <button className="btn sm accent" onClick={onResetConfirm}>Reset</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
