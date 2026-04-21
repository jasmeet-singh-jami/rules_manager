import { useState, FormEvent } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { login as apiLogin } from '../api/auth'
import { useAuth } from '../context/AuthContext'

export function LoginPage() {
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
      const res = await apiLogin(username, password)
      login(res.token, res.user, res.client_access_ids, res.must_change_password)
      navigate('/')
    } catch {
      setError('Invalid username or password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', minHeight: '100vh' }}>
      <div style={{ display: 'grid', placeItems: 'center', padding: 40 }}>
        <form className="card" style={{ width: 360 }} onSubmit={handleSubmit}>
          <div className="brand-mark" style={{ marginBottom: 16 }}>P</div>
          <h1 style={{ fontSize: 22, fontWeight: 600, margin: '0 0 4px' }}>Welcome back</h1>
          <div className="small muted" style={{ marginBottom: 20 }}>Sign in to Rules Manager</div>
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
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
          <div className="small muted" style={{ marginTop: 12, textAlign: 'center' }}>
            No account? <Link to="/register">Register</Link>
          </div>
        </form>
      </div>
      <div style={{
        background: 'linear-gradient(135deg, var(--accent), var(--accent-strong))',
        display: 'grid', placeItems: 'center', color: 'var(--accent-ink)', padding: 40,
      }}>
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
