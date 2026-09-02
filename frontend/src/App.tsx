import { BrowserRouter, Route, Routes } from 'react-router'
import { ProtectedRoute } from './app/ProtectedRoute'
import { SessionBootstrap } from './app/SessionBootstrap'
import { LoginPage } from './features/auth/LoginPage'
import { EscritorioPage } from './features/escritorio/EscritorioPage'

/**
 * Uma tela só depois de logado (pedido do usuário): o Escritório é a `HomePage` agora - ponto,
 * projetos (que também é o board/kanban, ver `PainelProjetos`) e relatórios viraram painéis do
 * dock dentro dela (ver `EscritorioPage`/`PainelFlutuante`), não rotas separadas pra navegar. As
 * páginas que alimentam esses painéis (`ProjetosPage`, `ProjetoDetalhePage`, `RelatoriosPage`)
 * continuam existindo como componentes normais, só não têm mais rota própria aqui - `PainelProjetos`
 * mantém localmente "qual projeto está selecionado" só pra elas trocarem de visão sem tocar a URL
 * do navegador.
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
