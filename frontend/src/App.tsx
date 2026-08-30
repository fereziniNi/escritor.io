import { BrowserRouter, Route, Routes } from 'react-router'
import { HomePage } from './app/HomePage'
import { ProtectedRoute } from './app/ProtectedRoute'
import { SessionBootstrap } from './app/SessionBootstrap'
import { LoginPage } from './features/auth/LoginPage'
import { QuadroDetalhePage } from './features/kanban/QuadroDetalhePage'
import { QuadrosPage } from './features/kanban/QuadrosPage'
import { EquipesPage } from './features/organizacao/EquipesPage'
import { ProjetosPage } from './features/organizacao/ProjetosPage'
import { RelatoriosPage } from './features/relatorios/RelatoriosPage'

function App() {
  return (
    <BrowserRouter>
      <SessionBootstrap>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <HomePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/equipes"
            element={
              <ProtectedRoute papeisPermitidos={['ADMIN']}>
                <EquipesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/projetos"
            element={
              <ProtectedRoute papeisPermitidos={['ADMIN']}>
                <ProjetosPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/kanban"
            element={
              <ProtectedRoute>
                <QuadrosPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/kanban/:id"
            element={
              <ProtectedRoute>
                <QuadroDetalhePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/relatorios"
            element={
              <ProtectedRoute papeisPermitidos={['GESTOR', 'ADMIN']}>
                <RelatoriosPage />
              </ProtectedRoute>
            }
          />
        </Routes>
      </SessionBootstrap>
    </BrowserRouter>
  )
}

export default App
