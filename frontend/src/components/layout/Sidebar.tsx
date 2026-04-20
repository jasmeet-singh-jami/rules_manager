import { useState, useEffect, useRef } from 'react'
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
  const { clients, selectedClientId, setSelectedClientId } = useClients()
  const [switcherOpen, setSwitcherOpen] = useState(false)
  const switcherRef = useRef<HTMLDivElement>(null)
  const [ruleTypes, setRuleTypes] = useState<RuleType[]>([])
  const [rulesForClient, setRulesForClient] = useState<Rule[]>([])
  const onRulesPage = location.pathname.startsWith('/rules')

  useEffect(() => { getRuleTypes().then(setRuleTypes).catch(() => {}) }, [])
  useEffect(() => {
    if (!selectedClientId) { setRulesForClient([]); return }
    getRules({ client_id: selectedClientId }).then(setRulesForClient).catch(() => {})
  }, [selectedClientId])

  useEffect(() => {
    if (!switcherOpen) return
    function handleOutside(e: MouseEvent) {
      if (switcherRef.current && !switcherRef.current.contains(e.target as Node)) {
        setSwitcherOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [switcherOpen])

  const selectedClient = clients.find(c => c.id === selectedClientId)
  const countByType = (id: string) => rulesForClient.filter(r => r.rule_type_id === id).length

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

      {onRulesPage && (
        <div className="sidebar-section">
          <div className="sidebar-section-label">Rule Types</div>
          <div className="nav-sub">
            {ruleTypes.map(rt => {
              const isActive = location.pathname === `/rules/${rt.slug}` ||
                               location.pathname.startsWith(`/rules/${rt.slug}/`)
              return (
                <NavLink key={rt.id} to={`/rules/${rt.slug}`} className={() => `nav-item${isActive ? ' active' : ''}`}>
                  <span className="grow truncate">{rt.name}</span>
                  <span className="count">{countByType(rt.id) || ''}</span>
                </NavLink>
              )
            })}
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
          <div ref={switcherRef} className="user-role truncate" style={{ position: 'relative' }}>
            <button
              className="btn sm ghost"
              onClick={() => setSwitcherOpen(o => !o)}
              style={{ padding: '0 6px', height: 20, fontSize: 11 }}
            >
              {selectedClient?.code ?? 'Pick client'} <Icon name="chevD" size={10} />
            </button>
            {switcherOpen && (
              <div className="card" style={{ position: 'absolute', bottom: 24, left: 0, zIndex: 50, padding: 6, minWidth: 180 }}>
                {clients.map(c => (
                  <div key={c.id}
                       className={`nav-item${c.id === selectedClientId ? ' active' : ''}`}
                       onClick={() => { setSelectedClientId(c.id); setSwitcherOpen(false) }}>
                    <span className="grow truncate">{c.code}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </aside>
  )
}
