import { createContext, useContext, useState, ReactNode } from 'react'
import type { AuthUser } from '../api/auth'

interface AuthContextValue {
  user: AuthUser | null
  token: string | null
  clientAccess: string[]
  mustChangePassword: boolean
  login: (token: string, user: AuthUser, clientAccess: string[], mustChangePassword: boolean) => void
  logout: () => void
  addClientAccess: (clientId: string) => void
  hasEditAccess: (clientId: string) => boolean
  isAdmin: boolean
  clearMustChangePassword: () => void
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
  const [mustChangePassword, setMustChangePassword] = useState<boolean>(
    () => localStorage.getItem('auth_must_change_password') === 'true'
  )

  function login(newToken: string, newUser: AuthUser, newClientAccess: string[], newMustChangePassword: boolean) {
    localStorage.setItem('auth_token', newToken)
    localStorage.setItem('auth_user', JSON.stringify(newUser))
    localStorage.setItem('auth_client_access', JSON.stringify(newClientAccess))
    localStorage.setItem('auth_must_change_password', String(newMustChangePassword))
    setToken(newToken)
    setUser(newUser)
    setClientAccess(newClientAccess)
    setMustChangePassword(newMustChangePassword)
  }

  function addClientAccess(clientId: string) {
    setClientAccess(prev => {
      if (prev.includes(clientId)) return prev
      const updated = [...prev, clientId]
      localStorage.setItem('auth_client_access', JSON.stringify(updated))
      return updated
    })
  }

  function logout() {
    localStorage.removeItem('auth_token')
    localStorage.removeItem('auth_user')
    localStorage.removeItem('auth_client_access')
    localStorage.removeItem('auth_must_change_password')
    setToken(null)
    setUser(null)
    setClientAccess([])
    setMustChangePassword(false)
  }

  function clearMustChangePassword() {
    localStorage.setItem('auth_must_change_password', 'false')
    setMustChangePassword(false)
  }

  function hasEditAccess(clientId: string): boolean {
    if (user?.role === 'admin') return true
    return clientAccess.includes(clientId)
  }

  const isAdmin = user?.role === 'admin'

  return (
    <AuthContext.Provider value={{
      user, token, clientAccess, mustChangePassword,
      login, logout, addClientAccess, hasEditAccess, isAdmin, clearMustChangePassword,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
