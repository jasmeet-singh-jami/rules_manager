export interface ActionPreset { key: string; label: string; template: string }

const PRESETS: Record<string, ActionPreset[]> = {
  'noise-suppression': [
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
  return PRESETS[slug] ?? DEFAULT
}

export const FIELD_SUGGESTIONS: Record<string, string[]> = {
  'noise-suppression':         ['sourceId','alertName','severity','alertAge','description','resourceId','hostname','ciName','state','environmentName','applicationName','sourceType','categoryName'],
  'alert-classification':      ['alertName','severity','sourceId','description','resourceId'],
  'alert-service-classifier':  ['sourceId','alertName','severity','resourceId','status','description','hostname'],
  'alert-enrichment':          ['alertName','sourceId','severity','description'],
  'alert-correlation':         ['alertName','severity','resourceId','tags','duration','description'],
  'incident-creation':         ['severity','name','source','description','status','type','category','environment'],
  'incident-routing':          ['description','title','assignmentGroup','priority','status','source'],
  'incident-user-routing':     ['shortDescription','description','priority'],
  'issue-recommendation':      ['description','name','severity','source','status','category'],
}

export function getPrefix(slug: string): string {
  return slug === 'noise-suppression' ? 'groupedAlert' : ''
}
