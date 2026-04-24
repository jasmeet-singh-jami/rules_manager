import { useEffect, useMemo, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useClients } from '../../context/ClientContext'
import { getRuleTypes, getRules, type RuleType, type Rule } from '../../api/client'
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
  { to: '/knowledge', icon: 'folder', label: 'Knowledge Base' },
  { to: '/cron-jobs', icon: 'clock', label: 'Cron Jobs' },
  { to: '/clients', icon: 'clients', label: 'Clients' },
  { to: '/import', icon: 'import', label: 'Import DRL' },
]

const SETTINGS: NavEntry[] = [
  { to: '/admin', icon: 'shield', label: 'Admin', adminOnly: true },
  { to: '/account', icon: 'settings', label: 'Account' },
]

const KB_CATEGORIES = [
  { slug: 'integrations', label: 'Integrations' },
  { slug: 'automations', label: 'Automations' },
  { slug: 'issues', label: 'Issues' },
]

export function Sidebar() {
  const { user, isAdmin } = useAuth()
  const username = user?.username ?? ''
  const roleLabel = useMemo(() => {
    if (!user?.role) return 'User'
    return user.role === 'admin' ? 'Administrator' : 'Contributor'
  }, [user?.role])
  const location = useLocation()
  const { selectedClientId, rulesVersion } = useClients()
  const [ruleTypes, setRuleTypes] = useState<RuleType[]>([])
  const [rulesForClient, setRulesForClient] = useState<Rule[]>([])
  const onRulesPage = location.pathname.startsWith('/rules')
  const onKnowledgePage = location.pathname.startsWith('/knowledge')

  useEffect(() => { getRuleTypes().then(setRuleTypes).catch(() => {}) }, [])
  useEffect(() => {
    if (!selectedClientId) {
      setRulesForClient([])
      return
    }
    getRules({ client_id: selectedClientId }).then(setRulesForClient).catch(() => {})
  }, [selectedClientId, rulesVersion])

  const countByType = (id: string) => rulesForClient.filter(rule => rule.rule_type_id === id).length

  const renderItem = (entry: NavEntry) => {
    if (entry.adminOnly && !isAdmin) return null
    const isActive =
      entry.to === '/'
        ? location.pathname === '/'
        : location.pathname === entry.to || location.pathname.startsWith(entry.to + '/')
    return (
      <NavLink key={entry.to} to={entry.to} className={() => `nav-item${isActive ? ' active' : ''}`}>
        <Icon name={entry.icon} />
        <span className="truncate grow">{entry.label}</span>
      </NavLink>
    )
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <img src="/icon.png" alt="Polycloud" style={{ width: 28, height: 28, borderRadius: 6, flexShrink: 0 }} />
        <div>
          <div className="brand-name">Polycloud</div>
          <div className="brand-sub">Rules Manager</div>
        </div>
      </div>

      <div className="sidebar-section">
        <div className="sidebar-section-label">Workspace</div>
        {WORKSPACE.map(renderItem)}
      </div>

      {onRulesPage && (
        <div className="sidebar-section">
          <div className="sidebar-section-label">Rule Types</div>
          <div className="nav-sub">
            {ruleTypes.map(ruleType => {
              const isActive = location.pathname === `/rules/${ruleType.slug}` ||
                               location.pathname.startsWith(`/rules/${ruleType.slug}/`)
              return (
                <NavLink key={ruleType.id} to={`/rules/${ruleType.slug}`} className={() => `nav-item${isActive ? ' active' : ''}`}>
                  <span className="grow truncate">{ruleType.name}</span>
                  <span className="count">{countByType(ruleType.id) || ''}</span>
                </NavLink>
              )
            })}
          </div>
        </div>
      )}

      {onKnowledgePage && (
        <div className="sidebar-section">
          <div className="sidebar-section-label">Categories</div>
          <div className="nav-sub">
            {KB_CATEGORIES.map(cat => (
              <NavLink
                key={cat.slug}
                to={`/knowledge/${cat.slug}`}
                className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
              >
                <span className="grow truncate">{cat.label}</span>
              </NavLink>
            ))}
          </div>
        </div>
      )}

      <div className="sidebar-section">
        <div className="sidebar-section-label">Settings</div>
        {SETTINGS.map(renderItem)}
      </div>

      <div className="sidebar-footer">
        <div className="avatar">{(username || '?').slice(0, 2).toUpperCase()}</div>
        <div className="user-meta grow">
          <div className="user-name truncate">{username}</div>
          <div className="user-role truncate">{roleLabel}</div>
        </div>
      </div>
    </aside>
  )
}
