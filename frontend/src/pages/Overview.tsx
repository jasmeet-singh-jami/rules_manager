import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useClients } from '../context/ClientContext'
import {
  getRuleTypes, getRules, getDeployments, getKnowledgeDocs, getCronJobs,
  type RuleType, type Rule, type Deployment, type KnowledgeDocument, type CronJob,
} from '../api/client'
import { Icon, type IconName } from '../components/Icon'

function StatCard({ label, value, icon, sub, onClick }: { label: string; value: string | number; icon: IconName; sub?: string; onClick?: () => void }) {
  return (
    <div className="stat" onClick={onClick} style={onClick ? { cursor: 'pointer' } : undefined}>
      <div className="stat-label"><Icon name={icon} size={13} /> {label}</div>
      <div className="stat-value">{value}</div>
      {sub && <div className="stat-delta">{sub}</div>}
    </div>
  )
}

export function Overview() {
  const navigate = useNavigate()
  const { clients } = useClients()
  const [overviewClientId, setOverviewClientId] = useState<string | null>(null)
  const [ruleTypes, setRuleTypes] = useState<RuleType[]>([])
  const [rules, setRules] = useState<Rule[]>([])
  const [deployments, setDeployments] = useState<Deployment[]>([])
  const [knowledgeDocs, setKnowledgeDocs] = useState<KnowledgeDocument[]>([])
  const [cronJobs, setCronJobs] = useState<CronJob[]>([])

  useEffect(() => {
    getRuleTypes().then(ruleTypeData => setRuleTypes(ruleTypeData))
  }, [])

  useEffect(() => {
    if (overviewClientId) {
      getRules({ client_id: overviewClientId }).then(setRules).catch(() => {})
      getKnowledgeDocs({ client_id: overviewClientId }).then(setKnowledgeDocs).catch(() => {})
      getCronJobs(overviewClientId).then(setCronJobs).catch(() => {})
      getDeployments(overviewClientId).then(setDeployments).catch(() => setDeployments([]))
    } else {
      getRules().then(setRules).catch(() => {})
      getKnowledgeDocs().then(setKnowledgeDocs).catch(() => {})
      getCronJobs().then(setCronJobs).catch(() => {})
      Promise.all(clients.map(client => getDeployments(client.id).catch(() => [])))
        .then(arrays => setDeployments(arrays.flat()))
    }
  }, [clients, overviewClientId])

  const activeRules = rules.filter(rule => rule.enabled).length

  const byType = useMemo(() => {
    const max = Math.max(1, ...ruleTypes.map(ruleType => rules.filter(rule => rule.rule_type_id === ruleType.id).length))
    return ruleTypes.map(ruleType => ({
      rt: ruleType,
      count: rules.filter(rule => rule.rule_type_id === ruleType.id).length,
      pct: rules.filter(rule => rule.rule_type_id === ruleType.id).length / max * 100,
    }))
  }, [ruleTypes, rules])

  const activity = useMemo(() => {
    const ruleItems = rules.map(rule => ({ kind: 'rule' as const, at: rule.updated_at, what: rule.name }))
    const deploymentItems = deployments.map(deployment => ({ kind: 'deploy' as const, at: deployment.created_at, what: `v${deployment.version} · ${deployment.status}` }))
    return [...ruleItems, ...deploymentItems].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 10)
  }, [rules, deployments])

  const totalRulesAcrossTypes = byType.reduce((s, b) => s + b.count, 0)

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="page-eyebrow">Operator Console</div>
          <h1 className="page-title">
            Overview, <em>at a glance.</em>
          </h1>
          <div className="page-sub">Activity across clients, rule types, knowledge, and crons — all in one console.</div>
        </div>
        <div className="page-actions">
          <select
            className="select"
            value={overviewClientId ?? ''}
            aria-label="Overview client"
            onChange={e => setOverviewClientId(e.target.value || null)}
          >
            <option value="">All clients</option>
            {clients.map(client => (
              <option key={client.id} value={client.id}>{client.code} - {client.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="stats">
        <StatCard label="Clients" value={clients.length} icon="clients" onClick={() => navigate('/clients')} />
        <StatCard label="Total rules" value={rules.length} icon="rules"
                  sub={`${activeRules} enabled`} onClick={() => navigate('/rules')} />
        <StatCard label="Knowledge Base" value={knowledgeDocs.length} icon="folder" onClick={() => navigate('/knowledge/integrations')} />
        <StatCard label="Total crons" value={cronJobs.length} icon="clock" onClick={() => navigate('/cron-jobs')} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 24, marginBottom: 24 }}>
        <div className="editorial-card">
          <div className="editorial-card-head">
            <div>
              <h2 className="editorial-card-title">Rules by type</h2>
              <div className="editorial-card-sub">{overviewClientId ? 'For the selected client' : 'Across all clients'}</div>
            </div>
            <div className="eyebrow" style={{ alignSelf: 'center' }}>{totalRulesAcrossTypes} total</div>
          </div>
          <div>
            {byType.length === 0 ? (
              <div className="empty"><div className="empty-title">No rule types yet</div></div>
            ) : (
              byType.map(({ rt, count }) => {
                const max = Math.max(1, ...byType.map(b => b.count), 12)
                const segments = 12
                const filled = Math.round((count / max) * segments)
                return (
                  <div key={rt.id} className="type-row" onClick={() => navigate(`/rules/${rt.slug}`)}>
                    <div>
                      <div className="type-name">{rt.name}</div>
                      <div className="type-meter-row">
                        <div className="brick-meter" aria-label={`${count} rules`}>
                          {Array.from({ length: segments }).map((_, i) => (
                            <div key={i} className={'brick' + (i < filled ? ' on' : '')} />
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className={'type-count' + (count === 0 ? ' zero' : '')}>{count}</div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        <div className="editorial-card">
          <div className="editorial-card-head">
            <div>
              <h2 className="editorial-card-title">Recent activity</h2>
              <div className="editorial-card-sub">Latest rule + deployment changes</div>
            </div>
          </div>
          <div>
            {activity.length === 0 ? <div className="empty">Nothing recent</div> :
              activity.map((item, index) => (
                <div key={index} className="feed-row">
                  <div className="feed-icon">
                    <Icon name={item.kind === 'rule' ? 'edit' : 'deploy'} size={14} />
                  </div>
                  <div className="grow" style={{ minWidth: 0 }}>
                    <div className="feed-what truncate">{item.what}</div>
                    <div className="feed-when">{new Date(item.at).toLocaleString()}</div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>

      <div className="editorial-card">
        <div className="editorial-card-head">
          <div>
            <h2 className="editorial-card-title">Clients</h2>
            <div className="editorial-card-sub">Quick access</div>
          </div>
          <button className="btn sm ghost" onClick={() => navigate('/clients')}>
            View all <Icon name="chevR" size={12} />
          </button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
          {clients.map(client => (
            <div key={client.id} className="client-tile"
                 onClick={() => navigate(`/clients/${client.id}/deployments`)}>
              <span className="client-code">{client.code}</span>
              <div className="client-name">{client.name}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
