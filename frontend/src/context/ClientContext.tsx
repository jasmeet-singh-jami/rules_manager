import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { getClients, type Client } from '../api/client'

interface ClientContextValue {
  selectedClientId: string | null
  setSelectedClientId: (id: string | null) => void
  addClient: (client: Client) => void
  clients: Client[]
  loading: boolean
  rulesVersion: number
  bumpRulesVersion: () => void
  categoriesVersion: number
  bumpCategoriesVersion: () => void
}

const STORAGE_KEY = 'polycloud.selectedClientId'
const ClientContext = createContext<ClientContextValue | null>(null)

export function ClientProvider({ children }: { children: ReactNode }) {
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedClientId, setSelectedClientIdRaw] = useState<string | null>(
    () => localStorage.getItem(STORAGE_KEY),
  )
  const [rulesVersion, setRulesVersion] = useState(0)
  const bumpRulesVersion = useCallback(() => setRulesVersion(v => v + 1), [])
  const [categoriesVersion, setCategoriesVersion] = useState(0)
  const bumpCategoriesVersion = useCallback(() => setCategoriesVersion(v => v + 1), [])

  useEffect(() => {
    let cancelled = false
    getClients()
      .then(cs => {
        if (cancelled) return
        setClients(cs)
        setSelectedClientIdRaw(prev => {
          const nextId = prev && cs.some(client => client.id === prev) ? prev : (cs[0]?.id ?? null)
          if (nextId) localStorage.setItem(STORAGE_KEY, nextId)
          else localStorage.removeItem(STORAGE_KEY)
          return nextId
        })
      })
      .finally(() => !cancelled && setLoading(false))
    return () => { cancelled = true }
  }, [])

  const setSelectedClientId = (id: string | null) => {
    setSelectedClientIdRaw(id)
    if (id) localStorage.setItem(STORAGE_KEY, id)
    else localStorage.removeItem(STORAGE_KEY)
  }

  const addClient = (client: Client) => {
    setClients(prev => prev.some(existing => existing.id === client.id) ? prev : [...prev, client])
    setSelectedClientId(client.id)
  }

  return (
    <ClientContext.Provider value={{ selectedClientId, setSelectedClientId, addClient, clients, loading, rulesVersion, bumpRulesVersion, categoriesVersion, bumpCategoriesVersion }}>
      {children}
    </ClientContext.Provider>
  )
}

export function useClients(): ClientContextValue {
  const ctx = useContext(ClientContext)
  if (!ctx) throw new Error('useClients must be used inside <ClientProvider>')
  return ctx
}
