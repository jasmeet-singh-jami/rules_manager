import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { getClients, type Client } from '../api/client'

interface ClientContextValue {
  selectedClientId: string | null
  setSelectedClientId: (id: string | null) => void
  clients: Client[]
  loading: boolean
}

const STORAGE_KEY = 'polycloud.selectedClientId'
const ClientContext = createContext<ClientContextValue | null>(null)

export function ClientProvider({ children }: { children: ReactNode }) {
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedClientId, setSelectedClientIdRaw] = useState<string | null>(
    () => localStorage.getItem(STORAGE_KEY),
  )

  useEffect(() => {
    let cancelled = false
    getClients()
      .then(cs => {
        if (cancelled) return
        setClients(cs)
        setSelectedClientIdRaw(prev => (!prev && cs.length > 0) ? cs[0].id : prev)
      })
      .finally(() => !cancelled && setLoading(false))
    return () => { cancelled = true }
  }, [])

  const setSelectedClientId = (id: string | null) => {
    setSelectedClientIdRaw(id)
    if (id) localStorage.setItem(STORAGE_KEY, id)
    else localStorage.removeItem(STORAGE_KEY)
  }

  return (
    <ClientContext.Provider value={{ selectedClientId, setSelectedClientId, clients, loading }}>
      {children}
    </ClientContext.Provider>
  )
}

export function useClients(): ClientContextValue {
  const ctx = useContext(ClientContext)
  if (!ctx) throw new Error('useClients must be used inside <ClientProvider>')
  return ctx
}
