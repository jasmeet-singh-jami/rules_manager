import type { ReactNode } from 'react'
import { Icon, type IconName } from './Icon'

interface EmptyStateProps {
  icon?: IconName
  title: string
  body?: string
  actions?: ReactNode
}

export function EmptyState({ icon = 'folder', title, body, actions }: EmptyStateProps) {
  return (
    <div className="empty">
      <div style={{ width: 44, height: 44, margin: '0 auto 12px', borderRadius: 10,
                    background: 'var(--accent-soft)', color: 'var(--accent)',
                    display: 'grid', placeItems: 'center' }}>
        <Icon name={icon} size={22} />
      </div>
      <div className="empty-title">{title}</div>
      {body && <div className="small muted" style={{ marginBottom: 12 }}>{body}</div>}
      {actions && <div className="hstack" style={{ justifyContent: 'center' }}>{actions}</div>}
    </div>
  )
}
