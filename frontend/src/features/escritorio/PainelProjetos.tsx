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
 *
 * `selecaoInicial` existe pro widget global do cronômetro ativo (`CronometroTarefaAtiva`, canto
 * superior direito do Escritório): clicar nele já abre este painel direto no projeto certo, com o
 * card certo pedido pra `ProjetoDetalhePage` expandir sozinho (`cardIdParaAbrir`). `EscritorioPage`
 * é responsável por remontar este componente (via `key`) quando a seleção muda enquanto o painel
 * já está aberto - sem isso o `useState` abaixo não reagiria a um clique seguinte.
 */
export function PainelProjetos({ selecaoInicial }: { selecaoInicial?: { projetoId: number; cardId: number } } = {}) {
  const [projetoSelecionado, setProjetoSelecionado] = useState<number | null>(selecaoInicial?.projetoId ?? null)

  if (projetoSelecionado === null) {
    return <ProjetosPage aoSelecionarProjeto={setProjetoSelecionado} />
  }

  return (
    <div>
      <button type="button" className="kanban-voltar" onClick={() => setProjetoSelecionado(null)}>
        ← Voltar pros projetos
      </button>
      <ProjetoDetalhePage projetoIdProp={projetoSelecionado} cardIdParaAbrir={selecaoInicial?.cardId} />
    </div>
  )
}
