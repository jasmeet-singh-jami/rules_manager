import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Layout } from './components/layout/Layout'
import { RuleLibrary } from './pages/RuleLibrary'
import { Clients } from './pages/Clients'
import { Deployments } from './pages/Deployments'
import { ImportDrl } from './pages/ImportDrl'

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<RuleLibrary />} />
          <Route path="/clients" element={<Clients />} />
          <Route path="/clients/:id/deployments" element={<Deployments />} />
          <Route path="/import" element={<ImportDrl />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  )
}
