export interface ActionPreset { key: string; label: string; template: string }

const SLUG_ALIASES: Record<string, string> = {
  'noise-suppression': 'noise_suppression',
  'alert-classification': 'alert_classifier',
  'alert-correlation': 'issue_correlation',
  'incident-creation': 'incident_rules',
  'issue-recommendation': 'recommendation',
  'email-ingestion': 'email_ingestion',
}

export function normalizeRuleTypeSlug(slug: string): string {
  return SLUG_ALIASES[slug] ?? slug
}

const PRESETS: Record<string, ActionPreset[]> = {
  noise_suppression: [
    { key: 'nsSuppress', label: 'Suppress alert',      template: 'request.getGroupedAlert().setIsAlertFiltered("TRUE");' },
    { key: 'nsPassThru', label: 'Pass through',        template: 'request.getGroupedAlert().setIsAlertFiltered("FALSE");' },
    { key: 'nsClose',    label: 'Close alert',         template: 'request.getGroupedAlert().setState("Closed");' },
    { key: 'nsMode',     label: 'Set suppression mode', template: 'request.setSuppressionMode("Rule");' },
    { key: 'custom',     label: 'Custom raw action',   template: '' },
  ],
}

const DEFAULT: ActionPreset[] = [
  { key: 'custom', label: 'Custom raw action', template: '' },
]

export function getActionPresets(slug: string): ActionPreset[] {
  return PRESETS[normalizeRuleTypeSlug(slug)] ?? DEFAULT
}

const FIELD_SUGGESTIONS_BY_SLUG: Record<string, string[]> = {
  noise_suppression: ['sourceId','alertName','severity','alertAge','description','resourceId','hostname','ciName','state','environmentName','applicationName','sourceType','categoryName'],
  alert_classifier: ['alertName','severity','sourceId','description','resourceId'],
  issue_correlation: ['alertName','severity','resourceId','tags','duration','description'],
  incident_rules: ['severity','name','source','description','status','type','category','environment'],
  recommendation: ['description','name','severity','source','status','category'],
  email_ingestion: ['alertName','severity','sourceId','description','resourceId'],
}

export function getFieldSuggestions(slug: string): string[] {
  return FIELD_SUGGESTIONS_BY_SLUG[normalizeRuleTypeSlug(slug)] ?? []
}

export function getPrefix(slug: string): string {
  return normalizeRuleTypeSlug(slug) === 'noise_suppression' ? 'groupedAlert' : ''
}
