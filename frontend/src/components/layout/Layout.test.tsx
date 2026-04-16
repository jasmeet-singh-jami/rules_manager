import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AuthProvider } from '../../context/AuthContext'
import { Layout } from './Layout'

describe('Layout', () => {
  it('renders the app title', () => {
    render(
      <AuthProvider>
        <MemoryRouter>
          <Layout><div>content</div></Layout>
        </MemoryRouter>
      </AuthProvider>
    )
    expect(screen.getByText('Rules Manager')).toBeInTheDocument()
  })

  it('renders nav links', () => {
    render(
      <AuthProvider>
        <MemoryRouter>
          <Layout><div /></Layout>
        </MemoryRouter>
      </AuthProvider>
    )
    expect(screen.getByRole('link', { name: /rule library/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /clients/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /import/i })).toBeInTheDocument()
  })

  it('renders children', () => {
    render(
      <AuthProvider>
        <MemoryRouter>
          <Layout><p>hello world</p></Layout>
        </MemoryRouter>
      </AuthProvider>
    )
    expect(screen.getByText('hello world')).toBeInTheDocument()
  })
})
