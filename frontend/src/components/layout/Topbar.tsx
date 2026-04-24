import { useState } from 'react'
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

export function Topbar() {
  const crumbs = useBreadcrumbs()
  const { logout } = useAuth()
  const navigate = useNavigate()
  const [theme, setTheme] = useState<string>(
    () => document.documentElement.dataset.theme ?? 'light'
  )

  async function handleLogout() {
    try { await apiLogout() } catch { /* ignore */ }
    logout()
    navigate('/login')
  }

  function handleToggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark'
    document.documentElement.dataset.theme = next
    localStorage.setItem('polycloud.theme', next)
    setTheme(next)
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
        <div className="topbar-search"
             role="button" tabIndex={0}
             title="Command palette (⌘K)"
             onClick={() => window.dispatchEvent(new Event('polycloud:open-palette'))}
             onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); window.dispatchEvent(new Event('polycloud:open-palette')) } }}>
          <Icon name="search" />
          <span className="grow muted small">Search rules, clients, deployments…</span>
          <span className="kbd">⌘K</span>
        </div>
        <button className="btn icon ghost" title="Toggle theme" onClick={handleToggleTheme}>
          <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
        </button>
        <button className="btn icon ghost" title="Log out" onClick={handleLogout}>
          <Icon name="x" />
        </button>
      </div>
    </div>
  )
}
