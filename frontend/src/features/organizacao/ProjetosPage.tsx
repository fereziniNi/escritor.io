import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { criarProjeto, listarEquipes, listarProjetos, vincularEquipeAoProjeto } from './api'
import type { StatusProjeto } from './types'

export function ProjetosPage() {
  const queryClient = useQueryClient()
  const [nome, setNome] = useState('')
  const [cliente, setCliente] = useState('')
  const [status, setStatus] = useState<StatusProjeto>('ATIVO')
  const [inicio, setInicio] = useState('')

  const projetosQuery = useQuery({ queryKey: ['projetos'], queryFn: listarProjetos })
  const equipesQuery = useQuery({ queryKey: ['equipes'], queryFn: listarEquipes })

  const criarMutation = useMutation({
    mutationFn: () => criarProjeto(nome, cliente, status, inicio),
    onSuccess: () => {
      setNome('')
      setCliente('')
      setInicio('')
      queryClient.invalidateQueries({ queryKey: ['projetos'] })
    },
  })

  const vincularMutation = useMutation({
    mutationFn: ({ projetoId, equipeId }: { projetoId: number; equipeId: number }) =>
      vincularEquipeAoProjeto(projetoId, equipeId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['projetos'] }),
  })

  const RÓTULO_STATUS: Record<StatusProjeto, string> = { ATIVO: 'Ativo', PAUSADO: 'Pausado', CONCLUIDO: 'Concluído' }

  return (
    <main className="pagina">
      <div className="pagina-cabecalho">
        <h1>📁 Projetos</h1>
      </div>

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

      {projetosQuery.isPending && <p className="mensagem-carregando">Carregando…</p>}
      {projetosQuery.isError && <p className="mensagem-erro">Não foi possível carregar os projetos.</p>}
      {projetosQuery.data?.length === 0 && <p className="mensagem-vazia">Nenhum projeto cadastrado ainda.</p>}
      <ul className="lista-cartoes">
        {projetosQuery.data?.map((projeto) => (
          <li key={projeto.id} className="cartao-item">
            <div className="cartao-item-cabecalho">
              <span className="cartao-item-titulo">{projeto.nome}</span>
              <span className="badge">{RÓTULO_STATUS[projeto.status]}</span>
            </div>
            <p className="cartao-item-meta">{projeto.cliente}</p>
            {equipesQuery.data && equipesQuery.data.length > 0 && (
              <div className="campo" style={{ marginTop: '0.5rem' }}>
                <select
                  aria-label={`Vincular equipe ao projeto ${projeto.nome}`}
                  defaultValue=""
                  onChange={(evento) => {
                    const equipeId = Number(evento.target.value)
                    if (equipeId) {
                      vincularMutation.mutate({ projetoId: projeto.id, equipeId })
                    }
                  }}
                >
                  <option value="" disabled>
                    Vincular equipe…
                  </option>
                  {equipesQuery.data.map((equipe) => (
                    <option key={equipe.id} value={equipe.id}>
                      {equipe.nome}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </li>
        ))}
      </ul>
    </main>
  )
}
