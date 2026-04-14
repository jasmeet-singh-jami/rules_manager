import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { Layout } from './Layout'

describe('Layout', () => {
  it('renders the app title', () => {
    render(
      <MemoryRouter>
        <Layout><div>content</div></Layout>
      </MemoryRouter>
    )
    expect(screen.getByText('Polycloud Rules Manager')).toBeInTheDocument()
  })

  it('renders nav links', () => {
    render(
      <MemoryRouter>
        <Layout><div /></Layout>
      </MemoryRouter>
    )
    expect(screen.getByRole('link', { name: /rule library/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /clients/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /import/i })).toBeInTheDocument()
  })

  it('renders children', () => {
    render(
      <MemoryRouter>
        <Layout><p>hello world</p></Layout>
      </MemoryRouter>
    )
    expect(screen.getByText('hello world')).toBeInTheDocument()
  })
})
