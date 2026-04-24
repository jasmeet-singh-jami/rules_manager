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
    <div className="page">
      <div className="page-head">
        <h1 className="page-title">Account</h1>
      </div>

      {mustChangePassword && (
        <div className="callout warn" style={{ marginBottom: 16 }}>
          You must set a new password before continuing.
        </div>
      )}

      <div className="card" style={{ maxWidth: 420 }}>
        <h2 style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 600 }}>Change Password</h2>

        {success && (
          <div className="callout ok" style={{ marginBottom: 14 }}>
            Password updated successfully.
          </div>
        )}
        {error && (
          <div className="callout danger" style={{ marginBottom: 14 }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="field" style={{ marginBottom: 12 }}>
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
          <div className="field" style={{ marginBottom: 12 }}>
            <label htmlFor="new-password">New Password</label>
            <input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              required
            />
          </div>
          <div className="field" style={{ marginBottom: 20 }}>
            <label htmlFor="confirm-password">Confirm Password</label>
            <input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="btn accent" disabled={loading}>
            {loading ? 'Saving…' : 'Update Password'}
          </button>
        </form>
      </div>
    </div>
  )
}
