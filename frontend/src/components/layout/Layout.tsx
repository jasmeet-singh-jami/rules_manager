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

  const isActive = (path: string) =>
    path === '/' ? pathname === '/' : pathname.startsWith(path)

  return (
    <>
      <header className="app-header">
        <span className="app-logo">
          <span className="app-logo-icon">⚡</span>
          <span className="app-logo-text">Rules Manager</span>
        </span>
        <nav className="app-nav">
          <Link to="/"        className={`nav-link${isActive('/')        ? ' active' : ''}`}>Rule Library</Link>
          <Link to="/clients" className={`nav-link${isActive('/clients') ? ' active' : ''}`}>Clients</Link>
          <Link to="/import"  className={`nav-link${isActive('/import')  ? ' active' : ''}`}>Import DRL</Link>
          {isAdmin && (
            <Link to="/admin" className={`nav-link${isActive('/admin')   ? ' active' : ''}`}>Admin</Link>
          )}
        </nav>
        <div className="app-header-user">
          <Link to="/account" className="username-chip" style={{ textDecoration: 'none' }}>{user?.username}</Link>
          <button className="btn-signout" onClick={handleLogout}>Sign out</button>
        </div>
      </header>
      <main className="page-wrap">{children}</main>
    </>
  )
}
