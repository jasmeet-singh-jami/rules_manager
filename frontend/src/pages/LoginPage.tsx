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
      login(res.token, res.user, res.client_access_ids)
      navigate('/')
    } catch {
      setError('Invalid username or password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: 360, margin: '80px auto', padding: '0 16px' }}>
      <h2 style={{ marginBottom: 24 }}>Sign in</h2>
      {error && <p className="error-msg">{error}</p>}
      <form onSubmit={handleSubmit}>
        <div className="form-row">
          <label htmlFor="username">Username</label>
          <input
            id="username"
            value={username}
            onChange={e => setUsername(e.target.value)}
            required
            autoFocus
          />
        </div>
        <div className="form-row">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
          />
        </div>
        <button className="btn-primary" type="submit" disabled={loading} style={{ width: '100%', marginTop: 8 }}>
          {loading ? 'Signing in\u2026' : 'Sign in'}
        </button>
      </form>
      <p style={{ marginTop: 16, textAlign: 'center', fontSize: 13 }}>
        No account? <Link to="/register">Register</Link>
      </p>
    </div>
  )
}
