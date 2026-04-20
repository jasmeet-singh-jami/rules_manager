import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { logout as apiLogout } from '../../api/auth'
import { Icon } from '../Icon'

function useBreadcrumbs(): string[] {
  const { pathname } = useLocation()
  if (pathname === '/') return ['Overview']
  const segs = pathname.split('/').filter(Boolean)
  const labelFor = (seg: string) =>
    ({ rules: 'Rules', deployments: 'Deployments', clients: 'Clients',
       import: 'Import DRL', admin: 'Admin', account: 'Account' } as Record<string, string>)[seg]
    ?? seg.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
  return segs.map(labelFor)
}

function toggleTheme() {
  const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'
  document.documentElement.dataset.theme = next
  localStorage.setItem('polycloud.theme', next)
}

export function Topbar() {
  const crumbs = useBreadcrumbs()
  const { logout } = useAuth()
  const navigate = useNavigate()
  const theme = document.documentElement.dataset.theme

  async function handleLogout() {
    try { await apiLogout() } catch { /* ignore */ }
    logout()
    navigate('/login')
  }

  return (
    <div className="topbar">
      <div className="breadcrumb">
        {crumbs.map((c, i) => (
          <span key={i}>
            {i > 0 && <span className="sep"> · </span>}
            <span className={i === crumbs.length - 1 ? 'current' : ''}>{c}</span>
          </span>
        ))}
      </div>
      <div className="topbar-right">
        <div className="topbar-search" title="Command palette (⌘K)">
          <Icon name="search" />
          <input readOnly placeholder="Search rules, clients, deployments…" />
          <span className="kbd">⌘K</span>
        </div>
        <button className="btn icon ghost" title="Toggle theme" onClick={toggleTheme}>
          <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
        </button>
        <button className="btn icon ghost" title="Log out" onClick={handleLogout}>
          <Icon name="x" />
        </button>
      </div>
    </div>
  )
}
