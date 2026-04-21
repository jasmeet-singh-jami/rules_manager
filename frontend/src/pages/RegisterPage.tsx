import { useState, FormEvent } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { register as apiRegister } from '../api/auth'
import { useAuth } from '../context/AuthContext'

export function RegisterPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await apiRegister(username, password)
      login(res.token, res.user, res.client_access_ids, res.must_change_password)
      navigate('/')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : ''
      setError(msg.includes('409') ? 'Username already taken' : 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-split">
      <div className="auth-form-col">
        <form className="card" style={{ width: 360 }} onSubmit={handleSubmit}>
          <div className="brand-mark" style={{ marginBottom: 16 }}>P</div>
          <h1 style={{ fontSize: 22, fontWeight: 600, margin: '0 0 4px' }}>Create account</h1>
          <div className="small muted" style={{ marginBottom: 20 }}>Set up your access to the rule library</div>
          <div className="field">
            <label htmlFor="username">Username</label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div className="field" style={{ marginTop: 12 }}>
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </div>
          {error && <div className="callout danger small" style={{ marginTop: 10 }}>{error}</div>}
          <button type="submit" className="btn accent" style={{ width: '100%', marginTop: 16 }} disabled={loading}>
            {loading ? 'Creating…' : 'Create account'}
          </button>
          <div className="small muted" style={{ marginTop: 12, textAlign: 'center' }}>
            Already have an account? <Link to="/login">Sign in</Link>
          </div>
        </form>
      </div>
      <div className="auth-hero-col" style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-strong))', color: 'var(--accent-ink)' }}>
        <div style={{ maxWidth: 380 }}>
          <div style={{ fontSize: 13, opacity: 0.8 }}>Polycloud</div>
          <h2 style={{ fontSize: 28, lineHeight: 1.2, margin: '6px 0 12px', fontWeight: 600 }}>
            Drools rules for every client, in one place.
          </h2>
        </div>
      </div>
    </div>
  )
}
