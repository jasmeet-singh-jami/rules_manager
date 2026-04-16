const BASE = '/api/auth'

export interface AuthUser {
  id: string
  username: string
  role: 'admin' | 'contributor'
}

export interface TokenResponse {
  token: string
  user: AuthUser
  client_access_ids: string[]
}

export interface MeResponse {
  id: string
  username: string
  role: 'admin' | 'contributor'
  client_access_ids: string[]
}

async function authRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  const token = localStorage.getItem('auth_token')
  if (token) headers['Authorization'] = `Bearer ${token}`
  const res = await fetch(`${BASE}${path}`, { ...init, headers })
  if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`)
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

export const register = (username: string, password: string) =>
  authRequest<TokenResponse>('/register', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  })

export const login = (username: string, password: string) =>
  authRequest<TokenResponse>('/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  })

export const logout = () =>
  authRequest<void>('/logout', { method: 'POST' })

export const getMe = () =>
  authRequest<MeResponse>('/me')

export const changePassword = (newPassword: string, confirmPassword: string) =>
  authRequest<void>('/me/password', {
    method: 'PATCH',
    body: JSON.stringify({ new_password: newPassword, confirm_password: confirmPassword }),
  })
