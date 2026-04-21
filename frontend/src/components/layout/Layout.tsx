import { useEffect, useState, type ReactNode } from 'react'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { ToastProvider } from '../Toast'
import { CommandPalette } from '../CommandPalette/CommandPalette'

interface LayoutProps {
  children: ReactNode
}

export function Layout({ children }: LayoutProps) {
  const [paletteOpen, setPaletteOpen] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault(); setPaletteOpen(o => !o)
      } else if (e.key === 'Escape' && paletteOpen) {
        setPaletteOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [paletteOpen])

  useEffect(() => {
    const onOpen = () => setPaletteOpen(true)
    window.addEventListener('polycloud:open-palette', onOpen)
    return () => window.removeEventListener('polycloud:open-palette', onOpen)
  }, [])

  return (
    <ToastProvider>
      <div className="app">
        <Sidebar />
        <main className="main">
          <Topbar />
          <div className="page-outlet">{children}</div>
        </main>
      </div>
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </ToastProvider>
  )
}
