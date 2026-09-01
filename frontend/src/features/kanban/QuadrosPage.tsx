import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router'
import { useAuthStore } from '../auth/authStore'
import { criarQuadro, listarQuadros } from './api'

/**
 * `aoSelecionarQuadro` é opcional - só existe pro `PainelKanban` (dock do Escritório, "uma tela
 * só") poder trocar de visão sem navegar de verdade. Sem ele (uso direto via rota `/kanban`,
 * como sempre foi), o clique continua sendo um `<Link>` normal.
 */
export function QuadrosPage({ aoSelecionarQuadro }: { aoSelecionarQuadro?: (id: number) => void } = {}) {
  const queryClient = useQueryClient()
  const papel = useAuthStore((estado) => estado.papel)
  const podeCriar = papel === 'GESTOR' || papel === 'ADMIN'

  const [nome, setNome] = useState('')
  const [projetoId, setProjetoId] = useState('')

  const quadrosQuery = useQuery({ queryKey: ['quadros'], queryFn: listarQuadros })

  const criarMutation = useMutation({
    mutationFn: () =>
      criarQuadro({
        nome,
        projetoId: projetoId === '' ? null : Number(projetoId),
      }),
    onSuccess: () => {
      setNome('')
      setProjetoId('')
      queryClient.invalidateQueries({ queryKey: ['quadros'] })
    },
  })

  return (
    <main className="pagina">
      <div className="pagina-cabecalho">
        <h1>📋 Quadros</h1>
      </div>

      {podeCriar && (
        <form
          className="secao cartao"
          onSubmit={(evento) => {
            evento.preventDefault()
            criarMutation.mutate()
          }}
        >
          <div className="formulario">
            <div className="campo">
              <label htmlFor="nome-quadro">Nome</label>
              <input id="nome-quadro" value={nome} onChange={(evento) => setNome(evento.target.value)} required />
            </div>

            <div className="campo">
              <label htmlFor="projeto-quadro">Projeto (id)</label>
              <input
                id="projeto-quadro"
                value={projetoId}
                onChange={(evento) => setProjetoId(evento.target.value)}
              />
            </div>

            <div className="campo-acoes">
              <button type="submit" disabled={criarMutation.isPending}>
                ➕ Criar quadro
              </button>
              {criarMutation.isError && <p className="mensagem-erro">Não foi possível criar o quadro.</p>}
            </div>
          </div>
        </form>
      )}

      {quadrosQuery.isPending && <p className="mensagem-carregando">Carregando…</p>}
      {quadrosQuery.isError && <p className="mensagem-erro">Não foi possível carregar os quadros.</p>}
      {quadrosQuery.data?.length === 0 && <p className="mensagem-vazia">Nenhum quadro visível ainda.</p>}
      <ul className="lista-cartoes">
        {quadrosQuery.data?.map((quadro) => (
          <li key={quadro.id} className="cartao-item">
            {aoSelecionarQuadro ? (
              <button type="button" className="botao-secundario" style={{ width: '100%', textAlign: 'left' }} onClick={() => aoSelecionarQuadro(quadro.id)}>
                {quadro.nome}
              </button>
            ) : (
              <Link to={`/kanban/${quadro.id}`}>{quadro.nome}</Link>
            )}
          </li>
        ))}
      </ul>
    </main>
  )
}
