import { useState, FormEvent } from 'react'
import { changePassword } from '../api/auth'
import { useAuth } from '../context/AuthContext'

export function AccountPage() {
  const { mustChangePassword, clearMustChangePassword } = useAuth()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess(false)
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match')
      return
    }
    setLoading(true)
    try {
      await changePassword(currentPassword, newPassword, confirmPassword)
      clearMustChangePassword()
      setSuccess(true)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      const msg = err instanceof Error ? err.message : ''
      if (msg.includes('400')) {
        setError('Current password is incorrect')
      } else {
        setError('Failed to change password')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: 420, margin: '40px auto' }}>
      <h2 style={{ marginBottom: 20 }}>Account</h2>
      {mustChangePassword && (
        <div className="glass-card" style={{ padding: '12px 20px', marginBottom: 16, borderLeft: '3px solid var(--warn, #f59e0b)' }}>
          <p style={{ margin: 0, fontSize: 14 }}>You must set a new password before continuing.</p>
        </div>
      )}
      <div className="glass-card" style={{ padding: 28 }}>
        <h3 style={{ marginBottom: 20, fontSize: 16 }}>Change Password</h3>
        {success && (
          <p style={{ color: 'var(--ok)', marginBottom: 12 }}>Password updated successfully.</p>
        )}
        {error && <p className="error-msg" style={{ marginBottom: 12 }}>{error}</p>}
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <label htmlFor="current-password">Current Password</label>
            <input
              id="current-password"
              type="password"
              value={currentPassword}
              onChange={e => setCurrentPassword(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div className="form-row">
            <label htmlFor="new-password">New Password</label>
            <input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              required
            />
          </div>
          <div className="form-row">
            <label htmlFor="confirm-password">Confirm Password</label>
            <input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              required
            />
          </div>
          <button
            className="btn-primary"
            type="submit"
            disabled={loading}
            style={{ marginTop: 8 }}
          >
            {loading ? 'Saving…' : 'Update Password'}
          </button>
        </form>
      </div>
    </div>
  )
}
