import { useState } from 'react'
import { ProjetoDetalhePage } from '../kanban/ProjetoDetalhePage'
import { ProjetosPage } from '../organizacao/ProjetosPage'

/**
 * `ProjetosPage`/`ProjetoDetalhePage` navegam entre si via `<Link>`/`useParams` quando usadas em
 * rota de verdade. Aqui dentro do painel do dock não há rota `/projetos/:id` nenhuma - um
 * `<Router>` aninhado dentro do `<BrowserRouter>` do app não é permitido (react-router recusa em
 * runtime: "You cannot render a <Router> inside another <Router>"), então em vez disso o estado
 * de "qual projeto está selecionado" mora aqui e é passado como prop pras duas páginas (que
 * ganharam `aoSelecionarProjeto`/`projetoIdProp` opcionais só pra isso, sem mudar o comportamento
 * de quem ainda as usa via rota).
 */
export function PainelProjetos() {
  const [projetoSelecionado, setProjetoSelecionado] = useState<number | null>(null)

  if (projetoSelecionado === null) {
    return <ProjetosPage aoSelecionarProjeto={setProjetoSelecionado} />
  }

  return (
    <div>
      <button type="button" className="kanban-voltar" onClick={() => setProjetoSelecionado(null)}>
        ← Voltar pros projetos
      </button>
      <ProjetoDetalhePage projetoIdProp={projetoSelecionado} />
    </div>
  )
}
