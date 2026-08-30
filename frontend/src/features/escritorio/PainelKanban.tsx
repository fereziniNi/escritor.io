import { useState } from 'react'
import { QuadroDetalhePage } from '../kanban/QuadroDetalhePage'
import { QuadrosPage } from '../kanban/QuadrosPage'

/**
 * `QuadrosPage`/`QuadroDetalhePage` navegam entre si via `<Link>`/`useParams` quando usadas em
 * rota de verdade (S3). Aqui dentro do painel do dock não há rota `/kanban/:id` nenhuma - um
 * `<Router>` aninhado dentro do `<BrowserRouter>` do app não é permitido (react-router recusa em
 * runtime: "You cannot render a <Router> inside another <Router>"), então em vez disso o estado
 * de "qual quadro está selecionado" mora aqui e é passado como prop pras duas páginas (que
 * ganharam `aoSelecionarQuadro`/`quadroIdProp` opcionais só pra isso, sem mudar o comportamento
 * de quem ainda as usa via rota).
 */
export function PainelKanban() {
  const [quadroSelecionado, setQuadroSelecionado] = useState<number | null>(null)

  if (quadroSelecionado === null) {
    return <QuadrosPage aoSelecionarQuadro={setQuadroSelecionado} />
  }

  return (
    <div>
      <button type="button" onClick={() => setQuadroSelecionado(null)}>
        ← Voltar pros quadros
      </button>
      <QuadroDetalhePage quadroIdProp={quadroSelecionado} />
    </div>
  )
}
