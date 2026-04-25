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
    <div className="auth-shell">
      <header className="auth-header">
        <div className="brand-mark">P</div>
        <div className="brand-meta">
          <div className="brand-name">Polycloud</div>
          <div className="brand-sub">Rules · Manager</div>
        </div>
      </header>

      <main className="auth-main">
        <section className="auth-editorial">
          <div className="auth-eyebrow">Operator Console · 2026</div>
          <h1 className="auth-headline">
            Drools rules,<br />
            <em>engineered</em> for every client.
          </h1>
          <p className="auth-lede">
            Author, version, and ship Drools rule packages across every customer
            from a single console — with knowledge, cron jobs, and deployments living
            alongside the rules they govern.
          </p>
          <div className="auth-meta-list">
            <div className="item">
              <div className="num">06</div>
              <div className="lbl">Rule Types</div>
            </div>
            <div className="item">
              <div className="num">∞</div>
              <div className="lbl">Clients</div>
            </div>
            <div className="item">
              <div className="num">DRL</div>
              <div className="lbl">Native Output</div>
            </div>
          </div>
        </section>

        <form className="auth-card" onSubmit={handleSubmit}>
          <h1>Sign in</h1>
          <div className="auth-sub">Use your operator credentials to continue.</div>
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
          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </div>
          {error && <div className="callout danger small" style={{ marginTop: 14 }}>{error}</div>}
          <button type="submit" className="btn accent auth-submit" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in →'}
          </button>
          <div className="auth-foot">
            No account? <Link to="/register">Request access</Link>
          </div>
        </form>
      </main>

      <footer className="auth-footer">
        <span>© Polycloud Rules Manager</span>
        <span>v2026.04 · Operator Build</span>
      </footer>
    </div>
  )
}
