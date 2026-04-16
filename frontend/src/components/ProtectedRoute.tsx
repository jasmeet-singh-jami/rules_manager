import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import type { ReactNode } from 'react'

interface Props {
  children: ReactNode
  adminOnly?: boolean
}

export function ProtectedRoute({ children, adminOnly = false }: Props) {
  const { token, isAdmin, mustChangePassword } = useAuth()
  const { pathname } = useLocation()
  if (!token) return <Navigate to="/login" replace />
  if (mustChangePassword && pathname !== '/account') return <Navigate to="/account" replace />
  if (adminOnly && !isAdmin) return <Navigate to="/" replace />
  return <>{children}</>
}
