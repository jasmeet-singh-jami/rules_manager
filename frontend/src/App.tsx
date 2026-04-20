import { BrowserRouter, Routes, Route } from 'react-router-dom'
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
                    <Route path="/" element={<RuleLibrary />} />
                    <Route path="/clients" element={<Clients />} />
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
