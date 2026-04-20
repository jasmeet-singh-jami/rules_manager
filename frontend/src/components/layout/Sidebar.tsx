import { NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { Icon } from '../Icon'
import type { IconName } from '../Icon'

interface NavEntry {
  to: string
  icon: IconName
  label: string
  adminOnly?: boolean
}

const WORKSPACE: NavEntry[] = [
  { to: '/', icon: 'home', label: 'Overview' },
  { to: '/rules', icon: 'rules', label: 'Rules' },
  { to: '/deployments', icon: 'deploy', label: 'Deployments' },
  { to: '/clients', icon: 'clients', label: 'Clients' },
  { to: '/import', icon: 'import', label: 'Import DRL' },
]

const SETTINGS: NavEntry[] = [
  { to: '/admin', icon: 'shield', label: 'Admin', adminOnly: true },
  { to: '/account', icon: 'settings', label: 'Account' },
]

export function Sidebar() {
  const { user, isAdmin } = useAuth()
  const username = user?.username ?? ''
  const location = useLocation()

  const renderItem = (entry: NavEntry) => {
    if (entry.adminOnly && !isAdmin) return null
    const isActive =
      entry.to === '/'
        ? location.pathname === '/'
        : location.pathname === entry.to || location.pathname.startsWith(entry.to + '/')
    return (
      <NavLink key={entry.to} to={entry.to} className={`nav-item ${isActive ? 'active' : ''}`}>
        <Icon name={entry.icon} />
        <span className="truncate grow">{entry.label}</span>
      </NavLink>
    )
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="brand-mark">P</div>
        <div>
          <div className="brand-name">Polycloud</div>
          <div className="brand-sub">Rules Manager</div>
        </div>
      </div>

      <div className="sidebar-section">
        <div className="sidebar-section-label">Workspace</div>
        {WORKSPACE.map(renderItem)}
      </div>

      <div className="sidebar-section">
        <div className="sidebar-section-label">Settings</div>
        {SETTINGS.map(renderItem)}
      </div>

      <div className="sidebar-footer">
        <div className="avatar">{(username || '?').slice(0, 2).toUpperCase()}</div>
        <div className="user-meta grow">
          <div className="user-name truncate">{username}</div>
          <div className="user-role truncate">{isAdmin ? 'Admin' : 'Contributor'}</div>
        </div>
      </div>
    </aside>
  )
}
