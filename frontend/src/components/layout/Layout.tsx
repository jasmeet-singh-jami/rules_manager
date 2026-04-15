import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { logout as apiLogout } from '../../api/auth'

interface Props { children: React.ReactNode }

export function Layout({ children }: Props) {
  const { pathname } = useLocation()
  const { user, isAdmin, logout } = useAuth()
  const navigate = useNavigate()

  async function handleLogout() {
    try { await apiLogout() } catch { /* ignore errors */ }
    logout()
    navigate('/login')
  }

  const navLink = (to: string, label: string) => (
    <Link
      to={to}
      style={{
        color: '#fff',
        textDecoration: 'none',
        padding: '6px 14px',
        borderRadius: 7,
        fontWeight: 600,
        fontSize: 13,
        background: pathname === to ? 'rgba(255,255,255,0.18)' : 'transparent',
      }}
    >
      {label}
    </Link>
  )

  return (
    <>
      <header style={{
        background: 'linear-gradient(135deg, #0c3a70, #0f6fb3)',
        color: '#fff',
        padding: '14px 24px',
        display: 'flex',
        alignItems: 'center',
        gap: 32,
      }}>
        <h1 style={{ margin: 0, fontSize: '1.15rem', whiteSpace: 'nowrap' }}>
          Polycloud Rules Manager
        </h1>
        <nav style={{ display: 'flex', gap: 4, flex: 1 }}>
          {navLink('/', 'Rule Library')}
          {navLink('/clients', 'Clients')}
          {navLink('/import', 'Import DRL')}
          {isAdmin && navLink('/admin', 'Admin')}
        </nav>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13 }}>
          <span style={{ color: 'rgba(255,255,255,0.85)' }}>{user?.username}</span>
          <button
            onClick={handleLogout}
            style={{
              background: 'rgba(255,255,255,0.15)',
              border: '1px solid rgba(255,255,255,0.3)',
              color: '#fff',
              borderRadius: 6,
              padding: '4px 12px',
              cursor: 'pointer',
              fontSize: 12,
            }}
          >
            Sign out
          </button>
        </div>
      </header>
      <main className="page-wrap">{children}</main>
    </>
  )
}
