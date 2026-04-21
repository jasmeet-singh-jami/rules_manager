import type { ReactNode } from 'react'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { ToastProvider } from '../Toast'

interface LayoutProps {
  children: ReactNode
}

export function Layout({ children }: LayoutProps) {
  return (
    <ToastProvider>
      <div className="app">
        <Sidebar />
        <main className="main">
          <Topbar />
          <div className="page-outlet">{children}</div>
        </main>
      </div>
    </ToastProvider>
  )
}
