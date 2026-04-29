import { useEffect, useMemo, useState } from 'react'
import {
  createBrowserRouter,
  Navigate,
  Outlet,
  RouterProvider,
} from 'react-router-dom'
import { getRuleTypes, getKbCategories, getScriptCategories } from './api/client'
import { AuthProvider } from './context/AuthContext'
import { ClientProvider } from './context/ClientContext'
import { Layout } from './components/layout/Layout'
import { ProtectedRoute } from './components/ProtectedRoute'
import { RuleLibrary } from './pages/RuleLibrary'
import { Clients } from './pages/Clients'
import { Deployments } from './pages/Deployments'
import { ImportDrl } from './pages/ImportDrl'
import { LoginPage } from './pages/LoginPage'
import { RegisterPage } from './pages/RegisterPage'
import { AdminPage } from './pages/AdminPage'
import { AccountPage } from './pages/AccountPage'
import { RuleEditorPage } from './pages/RuleEditorPage/RuleEditorPage'
import { Overview } from './pages/Overview'
import { KnowledgeBase } from './pages/KnowledgeBase'
import { CronJobs } from './pages/CronJobs'

type RulesIndexStatus = 'loading' | 'ready' | 'empty' | 'error'

function AppShell() {
  return (
    <ProtectedRoute>
      <ClientProvider>
        <Layout>
          <Outlet />
        </Layout>
      </ClientProvider>
    </ProtectedRoute>
  )
}

function AdminOnlyRoute() {
  return (
    <ProtectedRoute adminOnly>
      <AdminPage />
    </ProtectedRoute>
  )
}

export function KnowledgeIndexRedirect() {
  const [status, setStatus] = useState<'loading' | 'ready' | 'empty' | 'error'>('loading')
  const [targetSlug, setTargetSlug] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    getKbCategories()
      .then(cats => {
        if (cancelled) return
        const first = cats[0]?.slug ?? null
        setTargetSlug(first)
        setStatus(first ? 'ready' : 'empty')
      })
      .catch(() => { if (!cancelled) setStatus('error') })
    return () => { cancelled = true }
  }, [])

  if (status === 'ready' && targetSlug) return <Navigate to={`/knowledge/${targetSlug}`} replace />
  if (status === 'empty') return <div className="page"><div className="empty">No knowledge base categories available</div></div>
  if (status === 'error') return <div className="page"><div className="empty">Unable to load categories</div></div>
  return <div className="page"><div className="empty">Loading...</div></div>
}

export function ScriptsIndexRedirect() {
  const [status, setStatus] = useState<'loading' | 'ready' | 'empty' | 'error'>('loading')
  const [targetSlug, setTargetSlug] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    getScriptCategories()
      .then(cats => {
        if (cancelled) return
        const first = cats[0]?.slug ?? null
        setTargetSlug(first)
        setStatus(first ? 'ready' : 'empty')
      })
      .catch(() => { if (!cancelled) setStatus('error') })
    return () => { cancelled = true }
  }, [])

  if (status === 'ready' && targetSlug) return <Navigate to={`/scripts/${targetSlug}`} replace />
  if (status === 'empty') return <div className="page"><div className="empty">No script categories available</div></div>
  if (status === 'error') return <div className="page"><div className="empty">Unable to load script categories</div></div>
  return <div className="page"><div className="empty">Loading...</div></div>
}

export function RulesIndexRedirect() {
  const [status, setStatus] = useState<RulesIndexStatus>('loading')
  const [targetSlug, setTargetSlug] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    getRuleTypes()
      .then((ruleTypes) => {
        if (cancelled) return

        const firstSlug = ruleTypes[0]?.slug ?? null
        setTargetSlug(firstSlug)
        setStatus(firstSlug ? 'ready' : 'empty')
      })
      .catch(() => {
        if (!cancelled) {
          setStatus('error')
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  if (status === 'ready' && targetSlug) {
    return <Navigate to={`/rules/${targetSlug}`} replace />
  }

  if (status === 'empty') {
    return <div className="page"><div className="empty">No rule types available</div></div>
  }

  if (status === 'error') {
    return <div className="page"><div className="empty">Unable to load rule types</div></div>
  }

  return <div className="page"><div className="empty">Loading...</div></div>
}

export function createAppRouter() {
  return createBrowserRouter([
    { path: '/login', element: <LoginPage /> },
    { path: '/register', element: <RegisterPage /> },
    {
      path: '/',
      element: <AppShell />,
      children: [
        { index: true, element: <Overview /> },
        { path: 'rules', element: <RulesIndexRedirect /> },
        { path: 'rules/:slug', element: <RuleLibrary /> },
        { path: 'rules/:slug/new', element: <RuleEditorPage /> },
        { path: 'rules/:slug/edit/:id', element: <RuleEditorPage /> },
        { path: 'clients', element: <Clients /> },
        { path: 'deployments', element: <Deployments /> },
        { path: 'clients/:id/deployments', element: <Deployments /> },
        { path: 'import', element: <ImportDrl /> },
        { path: 'knowledge', element: <KnowledgeIndexRedirect /> },
        { path: 'knowledge/:category', element: <KnowledgeBase /> },
        { path: 'scripts', element: <ScriptsIndexRedirect /> },
        { path: 'scripts/:category', element: <CronJobs /> },
        { path: 'account', element: <AccountPage /> },
        { path: 'admin', element: <AdminOnlyRoute /> },
        { path: '*', element: <Navigate to="/" replace /> },
      ],
    },
  ])
}

export default function App() {
  const router = useMemo(() => createAppRouter(), [])

  return (
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  )
}
