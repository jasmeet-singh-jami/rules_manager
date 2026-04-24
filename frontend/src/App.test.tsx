import { render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'

const { getRuleTypes } = vi.hoisted(() => ({
  getRuleTypes: vi.fn(),
}))

vi.mock('./api/client', () => ({
  getRuleTypes,
}))

vi.mock('./context/AuthContext', () => ({
  AuthProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}))

vi.mock('./context/ClientContext', () => ({
  ClientProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}))

vi.mock('./components/ProtectedRoute', () => ({
  ProtectedRoute: ({ children }: { children: ReactNode }) => <>{children}</>,
}))

vi.mock('./components/layout/Layout', () => ({
  Layout: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))

vi.mock('./pages/RuleLibrary', () => ({
  RuleLibrary: () => <div>Rule library route</div>,
}))

vi.mock('./pages/Clients', () => ({
  Clients: () => <div>Clients route</div>,
}))

vi.mock('./pages/Deployments', () => ({
  Deployments: () => <div>Deployments route</div>,
}))

vi.mock('./pages/ImportDrl', () => ({
  ImportDrl: () => <div>Import route</div>,
}))

vi.mock('./pages/LoginPage', () => ({
  LoginPage: () => <div>Login route</div>,
}))

vi.mock('./pages/RegisterPage', () => ({
  RegisterPage: () => <div>Register route</div>,
}))

vi.mock('./pages/AdminPage', () => ({
  AdminPage: () => <div>Admin route</div>,
}))

vi.mock('./pages/AccountPage', () => ({
  AccountPage: () => <div>Account route</div>,
}))

vi.mock('./pages/RuleEditorPage/RuleEditorPage', () => ({
  RuleEditorPage: () => <div>Editor route</div>,
}))

vi.mock('./pages/Overview', () => ({
  Overview: () => <div>Overview route</div>,
}))

describe('App router', () => {
  beforeEach(() => {
    getRuleTypes.mockReset()
  })

  afterEach(() => {
    window.history.pushState({}, '', '/')
  })

  it('redirects /rules to the first backend-ordered rule type slug', async () => {
    getRuleTypes.mockResolvedValue([
      { id: 'rt1', slug: 'alert_classifier' },
      { id: 'rt2', slug: 'noise_suppression' },
    ])

    window.history.pushState({}, '', '/rules')
    render(<App />)

    await screen.findByText('Rule library route')
    await waitFor(() => expect(window.location.pathname).toBe('/rules/alert_classifier'))
  })

  it('renders editor routes through the app data router without crashing', async () => {
    window.history.pushState({}, '', '/rules/noise_suppression/new')
    render(<App />)

    await screen.findByText('Editor route')
  })
})
