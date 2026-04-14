import { Link, useLocation } from 'react-router-dom'

interface Props { children: React.ReactNode }

export function Layout({ children }: Props) {
  const { pathname } = useLocation()

  const navLink = (to: string, label: string) => (
    <Link
      to={to}
      style={{
        color: '#fff',
        textDecoration: 'none',
        padding: '6px 14px',
        borderRadius: 7,
        fontWeight: 600,
        fontSize: 13,
        background: pathname === to ? 'rgba(255,255,255,0.18)' : 'transparent',
      }}
    >
      {label}
    </Link>
  )

  return (
    <>
      <header style={{
        background: 'linear-gradient(135deg, #0c3a70, #0f6fb3)',
        color: '#fff',
        padding: '14px 24px',
        display: 'flex',
        alignItems: 'center',
        gap: 32,
      }}>
        <h1 style={{ margin: 0, fontSize: '1.15rem', whiteSpace: 'nowrap' }}>
          Polycloud Rules Manager
        </h1>
        <nav style={{ display: 'flex', gap: 4 }}>
          {navLink('/', 'Rule Library')}
          {navLink('/clients', 'Clients')}
          {navLink('/import', 'Import DRL')}
        </nav>
      </header>
      <main className="page-wrap">{children}</main>
    </>
  )
}
