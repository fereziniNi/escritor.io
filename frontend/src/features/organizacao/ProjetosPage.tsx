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

  return (
    <main>
      <h1>Projetos</h1>

      <form
        onSubmit={(evento) => {
          evento.preventDefault()
          criarMutation.mutate()
        }}
      >
        <label htmlFor="nome-projeto">Nome</label>
        <input id="nome-projeto" value={nome} onChange={(evento) => setNome(evento.target.value)} required />

        <label htmlFor="cliente-projeto">Cliente</label>
        <input
          id="cliente-projeto"
          value={cliente}
          onChange={(evento) => setCliente(evento.target.value)}
          required
        />

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

        <label htmlFor="inicio-projeto">Início</label>
        <input
          id="inicio-projeto"
          type="date"
          value={inicio}
          onChange={(evento) => setInicio(evento.target.value)}
          required
        />

        <button type="submit" disabled={criarMutation.isPending}>
          Criar projeto
        </button>
        {criarMutation.isError && <p>Não foi possível criar o projeto.</p>}
      </form>

      {projetosQuery.isPending && <p>Carregando…</p>}
      {projetosQuery.isError && <p>Não foi possível carregar os projetos.</p>}
      <ul>
        {projetosQuery.data?.map((projeto) => (
          <li key={projeto.id}>
            {projeto.nome} — {projeto.cliente}
            {equipesQuery.data && equipesQuery.data.length > 0 && (
              <>
                {' '}
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
              </>
            )}
          </li>
        ))}
      </ul>
    </main>
  )
}
