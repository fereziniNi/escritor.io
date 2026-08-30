import { BrowserRouter, Route, Routes } from 'react-router'
import { ProtectedRoute } from './app/ProtectedRoute'
import { SessionBootstrap } from './app/SessionBootstrap'
import { LoginPage } from './features/auth/LoginPage'
import { EscritorioPage } from './features/escritorio/EscritorioPage'

/**
 * Uma tela só depois de logado (pedido do usuário): o Escritório é a `HomePage` agora - ponto,
 * quadros, relatórios e admin de equipes/projetos viraram painéis do dock dentro dela (ver
 * `EscritorioPage`/`PainelFlutuante`), não rotas separadas pra navegar. As páginas que alimentam
 * esses painéis (`QuadrosPage`, `QuadroDetalhePage`, `RelatoriosPage`, `EquipesPage`,
 * `ProjetosPage`) continuam existindo como componentes normais, só não têm mais rota própria aqui
 * - `PainelKanban` usa um `MemoryRouter` isolado só pra elas continuarem navegando entre si sem
 * tocar a URL do navegador.
 */
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
                <EscritorioPage />
              </ProtectedRoute>
            }
          />
        </Routes>
      </SessionBootstrap>
    </BrowserRouter>
  )
}

export default App
