import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
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

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <ClientProvider>
                  <Layout>
                    <Routes>
                      <Route path="/" element={<Navigate to="/rules/noise-suppression" replace />} />
                      <Route path="/rules" element={<Navigate to="/rules/noise-suppression" replace />} />
                      <Route path="/rules/:slug" element={<RuleLibrary />} />
                      <Route path="/rules/:slug/new" element={<RuleEditorPage />} />
                      <Route path="/rules/:slug/edit/:id" element={<RuleEditorPage />} />
                      <Route path="/clients" element={<Clients />} />
                      <Route path="/deployments" element={<Deployments />} />
                      <Route path="/clients/:id/deployments" element={<Deployments />} />
                      <Route path="/import" element={<ImportDrl />} />
                      <Route path="/account" element={<AccountPage />} />
                      <Route
                        path="/admin"
                        element={
                          <ProtectedRoute adminOnly>
                            <AdminPage />
                          </ProtectedRoute>
                        }
                      />
                    </Routes>
                  </Layout>
                </ClientProvider>
              </ProtectedRoute>
            }
          />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
