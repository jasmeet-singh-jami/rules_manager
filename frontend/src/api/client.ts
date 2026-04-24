const BASE = '/api'

// ── Types ──────────────────────────────────────────────────────────────────

export interface Client {
  id: string
  code: string
  name: string
  description: string | null
  created_at: string
}

export interface DrlFunction {
  id: string
  rule_type_id: string
  name: string
  body: string
}

export interface DrlImport {
  id: string
  rule_type_id: string
  statement: string
  kind: 'import' | 'global'
  is_shared: boolean
}

export interface RuleType {
  id: string
  slug: string
  name: string
  pipeline_stage: number
  drl_package: string
  functions: DrlFunction[]
  imports: DrlImport[]
}

export interface Rule {
  id: string
  client_id: string
  rule_type_id: string
  name: string
  description: string | null
  tool: string | null
  condition_raw: string | null
  action_raw: string | null
  condition_meta: unknown
  action_meta: unknown
  enabled: boolean
  window: number | null
  required_function_names: string[] | null
  required_import_statements: string[] | null
  created_at: string
  updated_at: string
}

export interface Deployment {
  id: string
  client_id: string
  version: string
  status: 'draft' | 'deployed'
  notes: string | null
  created_at: string
}

export interface KnowledgeDocument {
  id: string
  client_id: string
  category: string
  name: string
  description: string | null
  filename: string
  file_size: number
  mime_type: string
  uploaded_by: string | null
  created_at: string
}

export interface CronJob {
  id: string
  client_id: string
  name: string
  description: string | null
  filename: string
  file_size: number
  mime_type: string
  uploaded_by: string | null
  created_at: string
}

export interface KnowledgeDocFilters {
  client_id?: string
  category?: string
}

export interface ParsedRulePreview {
  name: string
  condition_raw: string
  action_raw: string
  required_function_names: string[]
  required_import_statements: string[]
}

export interface ParsedFilePreview {
  filename: string
  package: string
  rule_count: number
  functions: { name: string; body: string }[]
  imports: { statement: string; kind: string }[]
  rules: ParsedRulePreview[]
}

export interface ImportConfirmRule {
  client_id: string
  rule_type_id: string
  name: string
  description?: string
  tool?: string
  condition_raw: string
  action_raw: string
  required_function_names: string[]
  required_import_statements: string[]
}

export interface ImportConfirmPayload {
  rule_type_id: string
  functions: { name: string; body: string }[]
  imports: { statement: string; kind: string }[]
  rules: ImportConfirmRule[]
}

// ── Core request helper ───────────────────────────────────────────────────

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {}
  if (init.body && typeof init.body === 'string') {
    headers['Content-Type'] = 'application/json'
  }
  const token = localStorage.getItem('auth_token')
  if (token) headers['Authorization'] = `Bearer ${token}`
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { ...headers, ...init.headers as Record<string, string> },
  })
  if (res.status === 401) {
    localStorage.removeItem('auth_token')
    localStorage.removeItem('auth_user')
    localStorage.removeItem('auth_client_access')
    window.location.href = '/login'
    throw new Error('Unauthorized')
  }
  if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`)
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

// ── Clients ───────────────────────────────────────────────────────────────

export const getClients = () =>
  request<Client[]>('/clients')

export const createClient = (body: { code: string; name: string; description?: string }) =>
  request<Client>('/clients', { method: 'POST', body: JSON.stringify(body) })

export const updateClient = (id: string, body: { name?: string; description?: string }) =>
  request<Client>(`/clients/${id}`, { method: 'PUT', body: JSON.stringify(body) })

export const deleteClient = (id: string) =>
  request<void>(`/clients/${id}`, { method: 'DELETE' })

// ── Rule Types ────────────────────────────────────────────────────────────

export const getRuleTypes = () =>
  request<RuleType[]>('/rule-types')

export const getRuleFunctions = (ruleTypeId: string) =>
  request<DrlFunction[]>(`/rule-types/${ruleTypeId}/functions`)

export const createRuleFunction = (ruleTypeId: string, body: { name: string; body: string }) =>
  request<DrlFunction>(`/rule-types/${ruleTypeId}/functions`, { method: 'POST', body: JSON.stringify(body) })

export const updateRuleFunction = (ruleTypeId: string, funcId: string, body: { name?: string; body?: string }) =>
  request<DrlFunction>(`/rule-types/${ruleTypeId}/functions/${funcId}`, { method: 'PUT', body: JSON.stringify(body) })

export const deleteRuleFunction = (ruleTypeId: string, funcId: string) =>
  request<void>(`/rule-types/${ruleTypeId}/functions/${funcId}`, { method: 'DELETE' })

export const getRuleImports = (ruleTypeId: string) =>
  request<DrlImport[]>(`/rule-types/${ruleTypeId}/imports`)

export const createRuleImport = (ruleTypeId: string, body: { statement: string; kind: string; is_shared: boolean }) =>
  request<DrlImport>(`/rule-types/${ruleTypeId}/imports`, { method: 'POST', body: JSON.stringify(body) })

export const updateRuleImport = (ruleTypeId: string, importId: string, body: { statement?: string; kind?: string; is_shared?: boolean }) =>
  request<DrlImport>(`/rule-types/${ruleTypeId}/imports/${importId}`, { method: 'PUT', body: JSON.stringify(body) })

export const deleteRuleImport = (ruleTypeId: string, importId: string) =>
  request<void>(`/rule-types/${ruleTypeId}/imports/${importId}`, { method: 'DELETE' })

// ── Rules ─────────────────────────────────────────────────────────────────

export interface RuleFilters {
  client_id?: string
  rule_type?: string
  tool?: string
  search?: string
}

export const getRules = (filters: RuleFilters = {}) => {
  const params = new URLSearchParams()
  if (filters.client_id) params.set('client_id', filters.client_id)
  if (filters.rule_type) params.set('rule_type', filters.rule_type)
  if (filters.tool) params.set('tool', filters.tool)
  if (filters.search) params.set('search', filters.search)
  const qs = params.toString()
  return request<Rule[]>(`/rules${qs ? `?${qs}` : ''}`)
}

export const createRule = (body: Omit<Rule, 'id' | 'created_at' | 'updated_at'>) =>
  request<Rule>('/rules', { method: 'POST', body: JSON.stringify(body) })

export const updateRule = (id: string, body: Partial<Omit<Rule, 'id' | 'created_at' | 'updated_at'>>) =>
  request<Rule>(`/rules/${id}`, { method: 'PUT', body: JSON.stringify(body) })

export const deleteRule = (id: string) =>
  request<void>(`/rules/${id}`, { method: 'DELETE' })

export const copyRule = (id: string, target_client_id: string) =>
  request<Rule>(`/rules/${id}/copy`, { method: 'POST', body: JSON.stringify({ target_client_id }) })

export const exportRules = (rule_ids: string[]): Promise<Response> => {
  const token = localStorage.getItem('auth_token')
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`
  return fetch(`${BASE}/rules/export`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ rule_ids }),
  })
}

// ── Deployments ───────────────────────────────────────────────────────────

export const getDeployments = (client_id: string) =>
  request<Deployment[]>(`/clients/${client_id}/deployments`)

export const createDeployment = (body: { client_id: string; version: string; notes?: string }) =>
  request<Deployment>('/deployments', { method: 'POST', body: JSON.stringify(body) })

export const exportDeployment = (id: string): Promise<Response> => {
  const token = localStorage.getItem('auth_token')
  const headers: Record<string, string> = {}
  if (token) headers['Authorization'] = `Bearer ${token}`
  return fetch(`${BASE}/deployments/${id}/export`, { headers })
}

// ── Import ────────────────────────────────────────────────────────────────

export const parseDrlFile = async (file: File): Promise<ParsedFilePreview> => {
  const form = new FormData()
  form.append('file', file)
  const token = localStorage.getItem('auth_token')
  const headers: Record<string, string> = {}
  if (token) headers['Authorization'] = `Bearer ${token}`
  const res = await fetch(`${BASE}/import/parse`, { method: 'POST', body: form, headers })
  if (res.status === 401) {
    localStorage.removeItem('auth_token')
    localStorage.removeItem('auth_user')
    localStorage.removeItem('auth_client_access')
    window.location.href = '/login'
    throw new Error('Unauthorized')
  }
  if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`)
  return res.json() as Promise<ParsedFilePreview>
}

export const confirmImport = (payload: ImportConfirmPayload) =>
  request<{ imported: number; rule_ids: string[] }>('/import/confirm', {
    method: 'POST',
    body: JSON.stringify(payload),
  })

// ── Knowledge Base ────────────────────────────────────────────────────────────

export const getKnowledgeDocs = (filters: KnowledgeDocFilters = {}) => {
  const params = new URLSearchParams()
  if (filters.client_id) params.set('client_id', filters.client_id)
  if (filters.category) params.set('category', filters.category)
  const qs = params.toString()
  return request<KnowledgeDocument[]>(`/knowledge${qs ? `?${qs}` : ''}`)
}

export const uploadKnowledgeDoc = async (params: {
  client_id: string
  category: string
  name: string
  description?: string
  file: File
}): Promise<KnowledgeDocument> => {
  const form = new FormData()
  form.append('client_id', params.client_id)
  form.append('category', params.category)
  form.append('name', params.name)
  if (params.description !== undefined) form.append('description', params.description)
  form.append('file', params.file)
  const token = localStorage.getItem('auth_token')
  const headers: Record<string, string> = {}
  if (token) headers['Authorization'] = `Bearer ${token}`
  const res = await fetch(`${BASE}/knowledge`, { method: 'POST', body: form, headers })
  if (res.status === 401) {
    localStorage.removeItem('auth_token')
    localStorage.removeItem('auth_user')
    localStorage.removeItem('auth_client_access')
    window.location.href = '/login'
    throw new Error('Unauthorized')
  }
  if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`)
  return res.json() as Promise<KnowledgeDocument>
}

// TODO: redirect to /login on 401 (inherited gap from exportDeployment/exportRules)
export const downloadKnowledgeDoc = (id: string): Promise<Response> => {
  const token = localStorage.getItem('auth_token')
  const headers: Record<string, string> = {}
  if (token) headers['Authorization'] = `Bearer ${token}`
  return fetch(`${BASE}/knowledge/${id}/download`, { headers })
}

export const deleteKnowledgeDoc = (id: string) =>
  request<void>(`/knowledge/${id}`, { method: 'DELETE' })

// ── Cron Jobs ─────────────────────────────────────────────────────────────────

export const getCronJobs = (client_id?: string) => {
  const params = new URLSearchParams()
  if (client_id) params.set('client_id', client_id)
  const qs = params.toString()
  return request<CronJob[]>(`/cron-jobs${qs ? `?${qs}` : ''}`)
}

export const uploadCronJob = async (params: {
  client_id: string
  name: string
  description?: string
  file: File
}): Promise<CronJob> => {
  const form = new FormData()
  form.append('client_id', params.client_id)
  form.append('name', params.name)
  if (params.description !== undefined) form.append('description', params.description)
  form.append('file', params.file)
  const token = localStorage.getItem('auth_token')
  const headers: Record<string, string> = {}
  if (token) headers['Authorization'] = `Bearer ${token}`
  const res = await fetch(`${BASE}/cron-jobs`, { method: 'POST', body: form, headers })
  if (res.status === 401) {
    localStorage.removeItem('auth_token')
    localStorage.removeItem('auth_user')
    localStorage.removeItem('auth_client_access')
    window.location.href = '/login'
    throw new Error('Unauthorized')
  }
  if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`)
  return res.json() as Promise<CronJob>
}

// TODO: redirect to /login on 401 (inherited gap from exportDeployment/exportRules)
export const downloadCronJob = (id: string): Promise<Response> => {
  const token = localStorage.getItem('auth_token')
  const headers: Record<string, string> = {}
  if (token) headers['Authorization'] = `Bearer ${token}`
  return fetch(`${BASE}/cron-jobs/${id}/download`, { headers })
}

export const deleteCronJob = (id: string) =>
  request<void>(`/cron-jobs/${id}`, { method: 'DELETE' })
