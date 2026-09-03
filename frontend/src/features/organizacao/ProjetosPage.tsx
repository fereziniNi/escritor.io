import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router'
import { useAuthStore } from '../auth/authStore'
import { criarProjeto, listarProjetos } from './api'
import { ROTULO_STATUS_PROJETO, type StatusProjeto } from './types'

/**
 * `aoSelecionarProjeto` é opcional - só existe pro `PainelProjetos` (dock do Escritório, "uma
 * tela só") poder trocar de visão sem navegar de verdade. Sem ele (uso direto via rota, se um dia
 * existir), o clique continua sendo um `<Link>` normal. Pedido do cliente: "remova essa parte de
 * quadro, vamos trabalhar apenas com projeto" - Projeto virou o próprio quadro de trabalho, então
 * esta página (antes só CRUD administrativo) agora também é o ponto de entrada pro board de cada
 * projeto.
 */
export function ProjetosPage({ aoSelecionarProjeto }: { aoSelecionarProjeto?: (id: number) => void } = {}) {
  const queryClient = useQueryClient()
  const papel = useAuthStore((estado) => estado.papel)
  const podeCriar = papel === 'GESTOR' || papel === 'ADMIN'

  const [nome, setNome] = useState('')
  const [cliente, setCliente] = useState('')
  const [status, setStatus] = useState<StatusProjeto>('ATIVO')
  const [inicio, setInicio] = useState('')

  const projetosQuery = useQuery({ queryKey: ['projetos'], queryFn: listarProjetos })

  const criarMutation = useMutation({
    mutationFn: () => criarProjeto(nome, cliente, status, inicio),
    onSuccess: () => {
      setNome('')
      setCliente('')
      setInicio('')
      queryClient.invalidateQueries({ queryKey: ['projetos'] })
    },
  })

  return (
    <main className="pagina">
      <div className="pagina-cabecalho">
        <h1>📁 Projetos</h1>
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
              <label htmlFor="nome-projeto">Nome</label>
              <input id="nome-projeto" value={nome} onChange={(evento) => setNome(evento.target.value)} required />
            </div>

            <div className="campo">
              <label htmlFor="cliente-projeto">Cliente</label>
              <input
                id="cliente-projeto"
                value={cliente}
                onChange={(evento) => setCliente(evento.target.value)}
                required
              />
            </div>

            <div className="campo">
              <label htmlFor="status-projeto">Status</label>
              <select
                id="status-projeto"
                value={status}
                onChange={(evento) => setStatus(evento.target.value as StatusProjeto)}
              >
                <option value="ATIVO">Ativo</option>
                <option value="PAUSADO">Pausado</option>
                <option value="CONCLUIDO">Concluído</option>
              </select>
            </div>

            <div className="campo">
              <label htmlFor="inicio-projeto">Início</label>
              <input
                id="inicio-projeto"
                type="date"
                value={inicio}
                onChange={(evento) => setInicio(evento.target.value)}
                required
              />
            </div>

            <div className="campo-acoes">
              <button type="submit" disabled={criarMutation.isPending}>
                ➕ Criar projeto
              </button>
              {criarMutation.isError && <p className="mensagem-erro">Não foi possível criar o projeto.</p>}
            </div>
          </div>
        </form>
      )}

      {projetosQuery.isPending && <p className="mensagem-carregando">Carregando…</p>}
      {projetosQuery.isError && <p className="mensagem-erro">Não foi possível carregar os projetos.</p>}
      {projetosQuery.data?.length === 0 && <p className="mensagem-vazia">Nenhum projeto visível ainda.</p>}
      <ul className="lista-cartoes">
        {projetosQuery.data?.map((projeto) => (
          <li key={projeto.id} className="cartao-item">
            {aoSelecionarProjeto ? (
              <button
                type="button"
                className="botao-secundario"
                style={{ width: '100%', textAlign: 'left' }}
                onClick={() => aoSelecionarProjeto(projeto.id)}
              >
                <div className="cartao-item-cabecalho">
                  <span className="cartao-item-titulo">{projeto.nome}</span>
                  <span className="badge">{ROTULO_STATUS_PROJETO[projeto.status]}</span>
                </div>
                <p className="cartao-item-meta">{projeto.cliente}</p>
              </button>
            ) : (
              <Link to={`/projetos/${projeto.id}`}>
                <div className="cartao-item-cabecalho">
                  <span className="cartao-item-titulo">{projeto.nome}</span>
                  <span className="badge">{ROTULO_STATUS_PROJETO[projeto.status]}</span>
                </div>
                <p className="cartao-item-meta">{projeto.cliente}</p>
              </Link>
            )}
          </li>
        ))}
      </ul>
    </main>
  )
}
