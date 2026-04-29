import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import {
  getClients, getRuleTypes, type Client, type RuleType,
  getAdminAccessRequests, approveAccessRequest, denyAccessRequest,
  setUserRole, type AccessRequest,
} from '../api/client'
import { Icon } from '../components/Icon'
import { useToast } from '../components/Toast'
import { FunctionsPanel } from '../components/FunctionsPanel/FunctionsPanel'
import { KbCategoriesPanel, ScriptCategoriesPanel, RuleTypesPanel } from '../components/SubcategoriesPanel/SubcategoriesPanel'
import { useClients } from '../context/ClientContext'
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
  const { token: authToken, user: currentUser } = useAuth()
  const { categoriesVersion } = useClients()
  const token = authToken ?? ''

  const [users, setUsers] = useState<AdminUser[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [ruleTypes, setRuleTypes] = useState<RuleType[]>([])
  const [resetFor, setResetFor] = useState<AdminUser | null>(null)
  const [newPw, setNewPw] = useState('')
  const [expandedRuleTypeId, setExpandedRuleTypeId] = useState<string | null>(null)
  const [expandedSubcategory, setExpandedSubcategory] = useState<'kb' | 'scripts' | 'ruleTypes' | null>(null)
  const [accessRequests, setAccessRequests] = useState<AccessRequest[]>([])
  const [reviewingId, setReviewingId] = useState<string | null>(null)
  const [changingRoleFor, setChangingRoleFor] = useState<string | null>(null)

  useEffect(() => {
    listUsers(token).then(setUsers).catch(() => toast('Failed to load users', 'danger'))
    getClients().then(setClients).catch(() => {})
    getAdminAccessRequests('pending').then(setAccessRequests).catch(() => {})
  }, [token, toast])

  useEffect(() => {
    getRuleTypes().then(setRuleTypes).catch(() => toast('Failed to load rule types', 'danger'))
  }, [toast, categoriesVersion])

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

  const onApproveRequest = async (req: AccessRequest) => {
    setReviewingId(req.id)
    try {
      await approveAccessRequest(req.id)
      setAccessRequests(prev => prev.filter(r => r.id !== req.id))
      // Grant access in the users matrix as well
      setUsers(prev => prev.map(u =>
        u.id === req.user_id && !u.client_ids.includes(req.client_id)
          ? { ...u, client_ids: [...u.client_ids, req.client_id] }
          : u
      ))
      toast(`Access granted to ${req.username} for ${req.client_code}`, 'ok')
    } catch {
      toast('Failed to approve', 'danger')
    } finally {
      setReviewingId(null)
    }
  }

  const onDenyRequest = async (req: AccessRequest) => {
    setReviewingId(req.id)
    try {
      await denyAccessRequest(req.id)
      setAccessRequests(prev => prev.filter(r => r.id !== req.id))
      toast(`Request from ${req.username} denied`, 'ok')
    } catch {
      toast('Failed to deny', 'danger')
    } finally {
      setReviewingId(null)
    }
  }

  const onChangeRole = async (user: AdminUser, newRole: 'admin' | 'contributor') => {
    setChangingRoleFor(user.id)
    try {
      await setUserRole(user.id, newRole)
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, role: newRole } : u))
      toast(`${user.username} is now ${newRole}`, 'ok')
    } catch {
      toast('Failed to change role', 'danger')
    } finally {
      setChangingRoleFor(null)
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

      {/* Access Requests card */}
      {accessRequests.length > 0 && (
        <div className="card" style={{ padding: 0, marginBottom: 16 }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)',
                        fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
            Access Requests
            <span className="badge accent">{accessRequests.length}</span>
          </div>
          <table className="rules">
            <thead>
              <tr>
                <th>User</th>
                <th>Client</th>
                <th>Requested</th>
                <th className="col-actions"></th>
              </tr>
            </thead>
            <tbody>
              {accessRequests.map(req => (
                <tr key={req.id}>
                  <td className="cell-name">{req.username}</td>
                  <td><strong>{req.client_code}</strong> — {req.client_name}</td>
                  <td className="muted">{new Date(req.requested_at).toLocaleDateString()}</td>
                  <td className="col-actions">
                    <span style={{ display: 'flex', gap: 6 }}>
                      <button
                        className="btn sm accent"
                        disabled={reviewingId === req.id}
                        onClick={() => onApproveRequest(req)}
                      >
                        Approve
                      </button>
                      <button
                        className="btn sm danger-ghost"
                        disabled={reviewingId === req.id}
                        onClick={() => onDenyRequest(req)}
                      >
                        Deny
                      </button>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

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
                  {u.id === currentUser?.id ? (
                    <span className={`badge ${u.role === 'admin' ? 'accent' : 'neutral'}`}>{u.role}</span>
                  ) : (
                    <select
                      value={u.role}
                      disabled={changingRoleFor === u.id}
                      onChange={e => onChangeRole(u, e.target.value as 'admin' | 'contributor')}
                      style={{ fontSize: 12, padding: '2px 6px', borderRadius: 4,
                               border: '1px solid var(--border)', background: 'var(--surface)',
                               color: 'var(--text)', cursor: 'pointer' }}
                    >
                      <option value="contributor">contributor</option>
                      <option value="admin">admin</option>
                    </select>
                  )}
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

      <div className="card" style={{ padding: 0, marginTop: 16 }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)',
                      fontSize: 13, fontWeight: 600 }}>Sidebar Subcategories</div>
        <div style={{ padding: 16 }}>
          <div style={{ display: 'grid', gap: 12 }}>
            <div className="card" style={{ padding: 0 }}>
              <button
                className="btn ghost"
                onClick={() => setExpandedSubcategory(c => c === 'kb' ? null : 'kb')}
                style={{ width: '100%', justifyContent: 'space-between', padding: '14px 16px', borderRadius: 0 }}
              >
                <span>Knowledge Base categories</span>
                <Icon name={expandedSubcategory === 'kb' ? 'arrowUp' : 'arrowDown'} />
              </button>
              {expandedSubcategory === 'kb' && (
                <div style={{ borderTop: '1px solid var(--border)' }}>
                  <KbCategoriesPanel />
                </div>
              )}
            </div>
            <div className="card" style={{ padding: 0 }}>
              <button
                className="btn ghost"
                onClick={() => setExpandedSubcategory(c => c === 'scripts' ? null : 'scripts')}
                style={{ width: '100%', justifyContent: 'space-between', padding: '14px 16px', borderRadius: 0 }}
              >
                <span>Script categories</span>
                <Icon name={expandedSubcategory === 'scripts' ? 'arrowUp' : 'arrowDown'} />
              </button>
              {expandedSubcategory === 'scripts' && (
                <div style={{ borderTop: '1px solid var(--border)' }}>
                  <ScriptCategoriesPanel />
                </div>
              )}
            </div>
            <div className="card" style={{ padding: 0 }}>
              <button
                className="btn ghost"
                onClick={() => setExpandedSubcategory(c => c === 'ruleTypes' ? null : 'ruleTypes')}
                style={{ width: '100%', justifyContent: 'space-between', padding: '14px 16px', borderRadius: 0 }}
              >
                <span>Rule types</span>
                <Icon name={expandedSubcategory === 'ruleTypes' ? 'arrowUp' : 'arrowDown'} />
              </button>
              {expandedSubcategory === 'ruleTypes' && (
                <div style={{ borderTop: '1px solid var(--border)' }}>
                  <RuleTypesPanel />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: 0, marginTop: 16 }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)',
                      fontSize: 13, fontWeight: 600 }}>Rule Type Functions &amp; Imports</div>
        <div style={{ padding: 16 }}>
          {ruleTypes.length === 0 ? (
            <p className="muted" style={{ margin: 0 }}>No rule types available.</p>
          ) : (
            <div style={{ display: 'grid', gap: 12 }}>
              {ruleTypes.map(ruleType => (
                <div key={ruleType.id} className="card" style={{ padding: 0 }}>
                  <button
                    className="btn ghost"
                    onClick={() => setExpandedRuleTypeId(current => current === ruleType.id ? null : ruleType.id)}
                    style={{
                      width: '100%',
                      justifyContent: 'space-between',
                      padding: '14px 16px',
                      borderRadius: 0,
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className="mono">{ruleType.pipeline_stage}</span>
                      <span>{ruleType.name}</span>
                      <span className="small muted">
                        {ruleType.functions.length} functions, {ruleType.imports.length} imports
                      </span>
                    </span>
                    <Icon name={expandedRuleTypeId === ruleType.id ? 'arrowUp' : 'arrowDown'} />
                  </button>
                  {expandedRuleTypeId === ruleType.id && (
                    <div style={{ padding: 16, borderTop: '1px solid var(--border)' }}>
                      <FunctionsPanel ruleType={ruleType} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
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
