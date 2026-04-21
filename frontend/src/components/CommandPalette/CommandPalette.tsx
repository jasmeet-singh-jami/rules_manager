import { useCallback, useEffect, useState } from 'react'
import { Command } from 'cmdk'
import { useNavigate } from 'react-router-dom'
import { getRules, getClients, getRuleTypes,
         type Rule, type RuleType, type Client } from '../../api/client'
import './CommandPalette.css'

interface PaletteProps {
  open: boolean
  onClose: () => void
}

export function CommandPalette({ open, onClose }: PaletteProps) {
  const navigate = useNavigate()
  const [rules, setRules] = useState<Rule[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [ruleTypes, setRuleTypes] = useState<RuleType[]>([])

  useEffect(() => {
    if (!open) return
    Promise.all([getRules(), getClients(), getRuleTypes()])
      .then(([rs, cs, rts]) => { setRules(rs); setClients(cs); setRuleTypes(rts) })
      .catch(() => {})
  }, [open])

  const go = useCallback((path: string) => { onClose(); navigate(path) }, [navigate, onClose])

  if (!open) return null

  return (
    <div className="cmdk-backdrop" onClick={onClose}>
      <div className="cmdk-dialog" onClick={e => e.stopPropagation()}>
        <Command label="Command palette">
          <Command.Input autoFocus placeholder="Search rules, clients, pages…" />
          <Command.List>
            <Command.Empty>No results.</Command.Empty>
            <Command.Group heading="Pages">
              <Command.Item onSelect={() => go('/')}>Overview</Command.Item>
              <Command.Item onSelect={() => go('/rules')}>Rules</Command.Item>
              <Command.Item onSelect={() => go('/deployments')}>Deployments</Command.Item>
              <Command.Item onSelect={() => go('/clients')}>Clients</Command.Item>
              <Command.Item onSelect={() => go('/import')}>Import DRL</Command.Item>
            </Command.Group>
            <Command.Group heading="Rule types">
              {ruleTypes.map(rt => (
                <Command.Item key={rt.id} onSelect={() => go(`/rules/${rt.slug}`)}>
                  {rt.name}
                </Command.Item>
              ))}
            </Command.Group>
            <Command.Group heading="Clients">
              {clients.map(c => (
                <Command.Item key={c.id} onSelect={() => go(`/clients/${c.id}/deployments`)}>
                  {c.code} · {c.name}
                </Command.Item>
              ))}
            </Command.Group>
            <Command.Group heading="Rules">
              {rules.slice(0, 50).map(r => {
                const rt = ruleTypes.find(t => t.id === r.rule_type_id)
                return (
                  <Command.Item key={r.id}
                                onSelect={() => go(`/rules/${rt?.slug ?? ''}/edit/${r.id}`)}>
                    {r.name}
                  </Command.Item>
                )
              })}
            </Command.Group>
            <Command.Group heading="Actions">
              <Command.Item onSelect={() => {
                const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'
                document.documentElement.dataset.theme = next
                localStorage.setItem('polycloud.theme', next)
                onClose()
              }}>Toggle theme</Command.Item>
            </Command.Group>
          </Command.List>
        </Command>
      </div>
    </div>
  )
}
