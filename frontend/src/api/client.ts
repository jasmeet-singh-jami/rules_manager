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
  is_system_locked: boolean
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
  notes: string | null
  created_at: string
}

export interface KbCategory {
  id: string
  slug: string
  name: string
  sort_order: number
}

export interface KnowledgeDocument {
  id: string
  client_id: string
  kb_category_id: string | null
  kb_category: KbCategory | null
  name: string
  description: string | null
  filename: string
  file_size: number
  mime_type: string
  uploaded_by: string | null
  created_at: string
}

export interface ScriptCategory {
  id: string
  slug: string
  name: string
  file_extension: string
  mime_type: string
  sort_order: number
}

export interface CronJob {
  id: string
  client_id: string
  script_category_id: string | null
  script_category: ScriptCategory | null
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

export interface RuleTypeCreatePayload {
  slug: string
  name: string
  drl_package: string
  pipeline_stage?: number
}

export interface RuleTypeUpdatePayload {
  name?: string
  pipeline_stage?: number
}

export interface RuleTypeReorderItem {
  id: string
  pipeline_stage: number
}

export const getRuleTypes = () =>
  request<RuleType[]>('/rule-types')

export const createRuleType = (body: RuleTypeCreatePayload) =>
  request<RuleType>('/rule-types', { method: 'POST', body: JSON.stringify(body) })

export const updateRuleType = (id: string, body: RuleTypeUpdatePayload) =>
  request<RuleType>(`/rule-types/${id}`, { method: 'PATCH', body: JSON.stringify(body) })

export const deleteRuleType = (id: string) =>
  request<void>(`/rule-types/${id}`, { method: 'DELETE' })

export const reorderRuleTypes = (items: RuleTypeReorderItem[]) =>
  request<void>('/rule-types/reorder', { method: 'POST', body: JSON.stringify(items) })

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

// ── KB Categories ─────────────────────────────────────────────────────────────

export interface KbCategoryCreatePayload {
  slug: string
  name: string
  sort_order?: number
}

export interface KbCategoryUpdatePayload {
  name?: string
  sort_order?: number
}

export interface CategoryReorderItem {
  id: string
  sort_order: number
}

export const getKbCategories = () =>
  request<KbCategory[]>('/kb-categories')

export const createKbCategory = (body: KbCategoryCreatePayload) =>
  request<KbCategory>('/kb-categories', { method: 'POST', body: JSON.stringify(body) })

export const updateKbCategory = (id: string, body: KbCategoryUpdatePayload) =>
  request<KbCategory>(`/kb-categories/${id}`, { method: 'PATCH', body: JSON.stringify(body) })

export const deleteKbCategory = (id: string, reassignTo?: string) => {
  const qs = reassignTo ? `?reassign_to=${reassignTo}` : ''
  return request<void>(`/kb-categories/${id}${qs}`, { method: 'DELETE' })
}

export const reorderKbCategories = (items: CategoryReorderItem[]) =>
  request<void>('/kb-categories/reorder', { method: 'POST', body: JSON.stringify(items) })

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
  description: string
  file: File
}): Promise<KnowledgeDocument> => {
  const form = new FormData()
  form.append('client_id', params.client_id)
  form.append('category', params.category)
  form.append('name', params.name)
  form.append('description', params.description)
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

// ── Script Categories ─────────────────────────────────────────────────────────

export interface ScriptCategoryCreatePayload {
  slug: string
  name: string
  file_extension: string
  mime_type: string
  sort_order?: number
}

export interface ScriptCategoryUpdatePayload {
  name?: string
  file_extension?: string
  mime_type?: string
  sort_order?: number
}

export const getScriptCategories = () =>
  request<ScriptCategory[]>('/script-categories')

export const createScriptCategory = (body: ScriptCategoryCreatePayload) =>
  request<ScriptCategory>('/script-categories', { method: 'POST', body: JSON.stringify(body) })

export const updateScriptCategory = (id: string, body: ScriptCategoryUpdatePayload) =>
  request<ScriptCategory>(`/script-categories/${id}`, { method: 'PATCH', body: JSON.stringify(body) })

export const deleteScriptCategory = (id: string, reassignTo?: string) => {
  const qs = reassignTo ? `?reassign_to=${reassignTo}` : ''
  return request<void>(`/script-categories/${id}${qs}`, { method: 'DELETE' })
}

export const reorderScriptCategories = (items: CategoryReorderItem[]) =>
  request<void>('/script-categories/reorder', { method: 'POST', body: JSON.stringify(items) })

// ── Cron Jobs ─────────────────────────────────────────────────────────────────

export const getCronJobs = (client_id?: string, script_type?: string) => {
  const params = new URLSearchParams()
  if (client_id) params.set('client_id', client_id)
  if (script_type) params.set('script_type', script_type)
  const qs = params.toString()
  return request<CronJob[]>(`/cron-jobs${qs ? `?${qs}` : ''}`)
}

export const uploadCronJob = async (params: {
  client_id: string
  name: string
  description: string
  script: string
  script_type: string
}): Promise<CronJob> => {
  const form = new FormData()
  form.append('client_id', params.client_id)
  form.append('name', params.name)
  form.append('description', params.description)
  form.append('script', params.script)
  form.append('script_type', params.script_type)
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

// ── Access Requests ───────────────────────────────────────────────────────────

export interface AccessRequest {
  id: string
  user_id: string
  username: string
  client_id: string
  client_name: string
  client_code: string
  status: 'pending' | 'approved' | 'denied'
  requested_at: string
  reviewed_at: string | null
  reviewed_by_username: string | null
}

export const requestClientAccess = (clientId: string) =>
  request<AccessRequest>(`/clients/${clientId}/request-access`, { method: 'POST' })

export const getMyAccessRequests = () =>
  request<AccessRequest[]>('/access-requests/me')

export const getAdminAccessRequests = (reqStatus = 'pending') =>
  request<AccessRequest[]>(`/admin/access-requests?status=${reqStatus}`)

export const approveAccessRequest = (requestId: string) =>
  request<void>(`/admin/access-requests/${requestId}/approve`, { method: 'POST' })

export const denyAccessRequest = (requestId: string) =>
  request<void>(`/admin/access-requests/${requestId}/deny`, { method: 'POST' })

export const setUserRole = (userId: string, role: 'admin' | 'contributor') =>
  request<void>(`/admin/users/${userId}/role`, { method: 'PATCH', body: JSON.stringify({ role }) })
