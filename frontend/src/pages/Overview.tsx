import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useClients } from '../context/ClientContext'
import {
  getRuleTypes, getRules, getDeployments,
  type RuleType, type Rule, type Deployment,
} from '../api/client'
import { Icon, type IconName } from '../components/Icon'

function StatCard({ label, value, icon, sub }: { label: string; value: string | number; icon: IconName; sub?: string }) {
  return (
    <div className="stat">
      <div className="stat-label"><Icon name={icon} size={13} /> {label}</div>
      <div className="stat-value">{value}</div>
      {sub && <div className="stat-delta">{sub}</div>}
    </div>
  )
}

export function Overview() {
  const navigate = useNavigate()
  const { selectedClientId, clients } = useClients()
  const [ruleTypes, setRuleTypes] = useState<RuleType[]>([])
  const [rules, setRules] = useState<Rule[]>([])
  const [deployments, setDeployments] = useState<Deployment[]>([])

  useEffect(() => {
    getRuleTypes().then(rts => setRuleTypes(rts))
    Promise.all(clients.map(c => getDeployments(c.id).catch(() => [])))
      .then(arrs => setDeployments(arrs.flat()))
  }, [clients])

  useEffect(() => {
    if (!selectedClientId) { setRules([]); return }
    getRules({ client_id: selectedClientId }).then(setRules).catch(() => {})
  }, [selectedClientId])

  const activeRules = rules.filter(r => r.enabled).length
  const last30d = deployments.filter(d => {
    const when = new Date(d.created_at).getTime()
    return Date.now() - when < 30 * 24 * 60 * 60 * 1000
  }).length

  const byType = useMemo(() => {
    const max = Math.max(1, ...ruleTypes.map(rt => rules.filter(r => r.rule_type_id === rt.id).length))
    return ruleTypes.map(rt => ({
      rt, count: rules.filter(r => r.rule_type_id === rt.id).length,
      pct: rules.filter(r => r.rule_type_id === rt.id).length / max * 100,
    }))
  }, [ruleTypes, rules])

  const activity = useMemo(() => {
    const rItems = rules.map(r => ({ kind: 'rule' as const, at: r.updated_at, what: r.name }))
    const dItems = deployments.map(d => ({ kind: 'deploy' as const, at: d.created_at, what: `v${d.version} · ${d.status}` }))
    return [...rItems, ...dItems].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 10)
  }, [rules, deployments])

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Overview</h1>
          <div className="page-sub">Activity across clients and rule types</div>
        </div>
      </div>

      <div className="stats">
        <StatCard label="Total rules" value={rules.length} icon="rules"
                  sub={`${activeRules} enabled`} />
        <StatCard label="Clients" value={clients.length} icon="clients" />
        <StatCard label="Deployments (30d)" value={last30d} icon="deploy" />
        <StatCard label="Rule types" value={ruleTypes.length} icon="layers" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16, marginBottom: 16 }}>
        <div className="card" style={{ padding: 0 }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>Rules by type</div>
            <div className="small muted">For currently selected client</div>
          </div>
          <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {byType.length === 0 ? <span className="muted small">No rule types yet</span> :
              byType.map(({ rt, count, pct }) => (
                <div key={rt.id} style={{ cursor: 'pointer' }}
                     onClick={() => navigate(`/rules/${rt.slug}`)}>
                  <div style={{ display: 'flex', justifyContent: 'space-between',
                                fontSize: 12.5, marginBottom: 5 }}>
                    <span style={{ fontWeight: 500 }}>{rt.name}</span>
                    <span className="muted mono">{count}</span>
                  </div>
                  <div style={{ height: 6, background: 'var(--bg-sunken)',
                                borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ width: pct + '%', height: '100%',
                                  background: 'var(--accent)', borderRadius: 4 }} />
                  </div>
                </div>
              ))}
          </div>
        </div>

        <div className="card" style={{ padding: 0 }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>Recent activity</div>
            <div className="small muted">Latest rule + deployment changes</div>
          </div>
          <div style={{ padding: '8px 0' }}>
            {activity.length === 0 ? <div className="empty">Nothing recent</div> :
              activity.map((a, i) => (
                <div key={i} style={{ padding: '10px 16px', display: 'flex',
                                      gap: 10, alignItems: 'center',
                                      borderBottom: '1px solid var(--border)' }}>
                  <Icon name={a.kind === 'rule' ? 'edit' : 'deploy'} size={14} />
                  <div className="grow" style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13 }}>{a.what}</div>
                    <div className="small muted">{new Date(a.at).toLocaleString()}</div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>Clients</div>
            <div className="small muted">Quick access</div>
          </div>
          <button className="btn sm ghost" onClick={() => navigate('/clients')}>
            View all <Icon name="chevR" size={12} />
          </button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
          {clients.map(c => (
            <div key={c.id} style={{ padding: '14px 16px',
                                     borderRight: '1px solid var(--border)',
                                     borderBottom: '1px solid var(--border)',
                                     cursor: 'pointer' }}
                 onClick={() => navigate(`/clients/${c.id}/deployments`)}>
              <span className="cell-id">{c.code}</span>
              <div style={{ fontWeight: 500, marginTop: 4 }}>{c.name}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
