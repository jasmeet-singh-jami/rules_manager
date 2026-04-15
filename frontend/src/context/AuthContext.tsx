import { createContext, useContext, useState, ReactNode } from 'react'
import type { AuthUser } from '../api/auth'

interface AuthContextValue {
  user: AuthUser | null
  token: string | null
  clientAccess: string[]
  login: (token: string, user: AuthUser, clientAccess: string[]) => void
  logout: () => void
  hasEditAccess: (clientId: string) => boolean
  isAdmin: boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(
    () => localStorage.getItem('auth_token')
  )
  const [user, setUser] = useState<AuthUser | null>(() => {
    const raw = localStorage.getItem('auth_user')
    return raw ? JSON.parse(raw) : null
  })
  const [clientAccess, setClientAccess] = useState<string[]>(() => {
    const raw = localStorage.getItem('auth_client_access')
    return raw ? JSON.parse(raw) : []
  })

  function login(newToken: string, newUser: AuthUser, newClientAccess: string[]) {
    localStorage.setItem('auth_token', newToken)
    localStorage.setItem('auth_user', JSON.stringify(newUser))
    localStorage.setItem('auth_client_access', JSON.stringify(newClientAccess))
    setToken(newToken)
    setUser(newUser)
    setClientAccess(newClientAccess)
  }

  function logout() {
    localStorage.removeItem('auth_token')
    localStorage.removeItem('auth_user')
    localStorage.removeItem('auth_client_access')
    setToken(null)
    setUser(null)
    setClientAccess([])
  }

  function hasEditAccess(clientId: string): boolean {
    if (user?.role === 'admin') return true
    return clientAccess.includes(clientId)
  }

  const isAdmin = user?.role === 'admin' ?? false

  return (
    <AuthContext.Provider value={{ user, token, clientAccess, login, logout, hasEditAccess, isAdmin }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
