import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'

interface ToastItem { id: number; text: string; variant?: 'ok' | 'warn' | 'danger' | 'info' }
interface ToastContextValue { toast: (text: string, variant?: ToastItem['variant']) => void }

const ToastContext = createContext<ToastContextValue | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const toast = useCallback<ToastContextValue['toast']>((text, variant) => {
    const id = Date.now() + Math.random()
    setItems(prev => [...prev, { id, text, variant }])
    setTimeout(() => setItems(prev => prev.filter(i => i.id !== id)), 2200)
  }, [])
  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div style={{ position: 'fixed', bottom: 20, right: 20, display: 'flex',
                    flexDirection: 'column', gap: 8, zIndex: 200 }}>
        {items.map(i => (
          <div key={i.id} className={`badge ${i.variant ?? 'neutral'}`}
               style={{ height: 'auto', padding: '8px 12px', boxShadow: 'var(--shadow-md)' }}>
            {i.text}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>')
  return ctx
}
