import { useEffect, useState } from 'react'
import { getClients, getRuleTypes, Client, RuleType } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { FunctionsPanel } from '../components/FunctionsPanel/FunctionsPanel'

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
  const [ruleTypes, setRuleTypes] = useState<RuleType[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [resetPasswords, setResetPasswords] = useState<Record<string, string>>({})
  const [resetStatus, setResetStatus] = useState<Record<string, 'ok' | 'error' | ''>>({})
  const [expandedRuleType, setExpandedRuleType] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([listUsers(token), getClients(), getRuleTypes()])
      .then(([u, c, rts]) => { setUsers(u); setClients(c); setRuleTypes(rts) })
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

  async function handleResetPassword(userId: string) {
    const pw = resetPasswords[userId] ?? ''
    setResetStatus(prev => ({ ...prev, [userId]: '' }))
    try {
      const res = await fetch(`/api/admin/users/${userId}/password`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ new_password: pw }),
      })
      if (!res.ok) throw new Error()
      setResetStatus(prev => ({ ...prev, [userId]: 'ok' }))
      setResetPasswords(prev => ({ ...prev, [userId]: '' }))
    } catch {
      setResetStatus(prev => ({ ...prev, [userId]: 'error' }))
    }
  }

  if (loading) return <p className="muted" style={{ margin: '24px 0' }}>Loading…</p>
  if (error) return <p className="error-msg" style={{ margin: '24px 0' }}>{error}</p>

  const clientMap = Object.fromEntries(clients.map(c => [c.id, c]))

  return (
    <>
      <h2 style={{ margin: '20px 0 16px' }}>User Management</h2>
      <div className="glass-card" style={{ overflow: 'hidden' }}>
        <table>
          <thead>
            <tr>
              <th>Username</th>
              <th>Role</th>
              <th>Client Access</th>
              <th>Grant Access</th>
              <th>Reset Password</th>
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
                        background: 'var(--accent-dim)', border: '1px solid rgba(77,142,248,0.25)', borderRadius: 4,
                        padding: '2px 8px', fontSize: 12, display: 'flex', gap: 4, alignItems: 'center', color: 'var(--accent)'
                      }}>
                        {clientMap[cid]?.code ?? cid.slice(0, 8)}
                        <button
                          onClick={() => handleRevoke(u.id, cid)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', padding: 0, fontSize: 14, lineHeight: 1 }}
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
                <td>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <input
                      type="password"
                      placeholder="New password"
                      value={resetPasswords[u.id] ?? ''}
                      onChange={e =>
                        setResetPasswords(prev => ({ ...prev, [u.id]: e.target.value }))
                      }
                      style={{ fontSize: 12, padding: '3px 6px', width: 140 }}
                    />
                    <button
                      className="btn-primary"
                      onClick={() => handleResetPassword(u.id)}
                      disabled={!resetPasswords[u.id]}
                      style={{ fontSize: 12, padding: '3px 10px' }}
                    >
                      Reset
                    </button>
                    {resetStatus[u.id] === 'ok' && (
                      <span style={{ color: 'var(--ok)', fontSize: 12 }}>✓ Reset</span>
                    )}
                    {resetStatus[u.id] === 'error' && (
                      <span style={{ color: 'var(--danger)', fontSize: 12 }}>Failed</span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h2 style={{ margin: '32px 0 16px' }}>Rule Type Functions & Imports</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {ruleTypes.map(rt => (
          <div key={rt.id} className="glass-card" style={{ overflow: 'hidden' }}>
            <button
              onClick={() => setExpandedRuleType(prev => prev === rt.id ? null : rt.id)}
              style={{
                width: '100%', textAlign: 'left', background: 'none', border: 'none',
                cursor: 'pointer', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
              }}
            >
              <span>
                <strong>{rt.pipeline_stage}. {rt.name}</strong>
                <span className="muted" style={{ marginLeft: 10, fontSize: 12 }}>
                  {rt.functions.length} fn · {rt.imports.length} imports
                </span>
              </span>
              <span style={{ color: 'var(--muted)', fontSize: 18 }}>{expandedRuleType === rt.id ? '▲' : '▼'}</span>
            </button>
            {expandedRuleType === rt.id && (
              <div style={{ padding: '0 16px 16px', borderTop: '1px solid var(--line)' }}>
                <FunctionsPanel ruleType={rt} />
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  )
}
