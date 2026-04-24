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
  const { selectedClientId, setSelectedClientId, clients } = useClients()
  const [ruleTypes, setRuleTypes] = useState<RuleType[]>([])
  const [rules, setRules] = useState<Rule[]>([])
  const [deployments, setDeployments] = useState<Deployment[]>([])
  const [knowledgeDocs, setKnowledgeDocs] = useState<KnowledgeDocument[]>([])
  const [cronJobs, setCronJobs] = useState<CronJob[]>([])

  useEffect(() => {
    getRuleTypes().then(ruleTypeData => setRuleTypes(ruleTypeData))
    Promise.all(clients.map(client => getDeployments(client.id).catch(() => [])))
      .then(arrays => setDeployments(arrays.flat()))
    getKnowledgeDocs().then(setKnowledgeDocs).catch(() => {})
    getCronJobs().then(setCronJobs).catch(() => {})
  }, [clients])

  useEffect(() => {
    if (!selectedClientId) {
      setRules([])
      return
    }
    getRules({ client_id: selectedClientId }).then(setRules).catch(() => {})
  }, [selectedClientId])

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

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Overview</h1>
          <div className="page-sub">Activity across clients and rule types</div>
        </div>
        <div className="page-actions">
          <select
            className="select"
            value={selectedClientId ?? ''}
            aria-label="Overview client"
            onChange={e => setSelectedClientId(e.target.value || null)}
          >
            <option value="">Choose client...</option>
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

      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16, marginBottom: 16 }}>
        <div className="card" style={{ padding: 0 }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>Rules by type</div>
            <div className="small muted">For the selected client</div>
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
              activity.map((item, index) => (
                <div key={index} style={{ padding: '10px 16px', display: 'flex',
                                          gap: 10, alignItems: 'center',
                                          borderBottom: '1px solid var(--border)' }}>
                  <Icon name={item.kind === 'rule' ? 'edit' : 'deploy'} size={14} />
                  <div className="grow" style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13 }}>{item.what}</div>
                    <div className="small muted">{new Date(item.at).toLocaleString()}</div>
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
          {clients.map(client => (
            <div key={client.id} style={{ padding: '14px 16px',
                                          borderRight: '1px solid var(--border)',
                                          borderBottom: '1px solid var(--border)',
                                          cursor: 'pointer' }}
                 onClick={() => navigate(`/clients/${client.id}/deployments`)}>
              <span className="cell-id">{client.code}</span>
              <div style={{ fontWeight: 500, marginTop: 4 }}>{client.name}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
