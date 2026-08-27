import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useAuthStore } from '../auth/authStore'
import { criarQuadro, listarQuadros } from './api'

export function QuadrosPage() {
  const queryClient = useQueryClient()
  const papel = useAuthStore((estado) => estado.papel)
  const podeCriar = papel === 'GESTOR' || papel === 'ADMIN'

  const [nome, setNome] = useState('')
  const [projetoId, setProjetoId] = useState('')
  const [equipeId, setEquipeId] = useState('')

  const quadrosQuery = useQuery({ queryKey: ['quadros'], queryFn: listarQuadros })

  const criarMutation = useMutation({
    mutationFn: () =>
      criarQuadro({
        nome,
        projetoId: projetoId === '' ? null : Number(projetoId),
        equipeId: equipeId === '' ? null : Number(equipeId),
      }),
    onSuccess: () => {
      setNome('')
      setProjetoId('')
      setEquipeId('')
      queryClient.invalidateQueries({ queryKey: ['quadros'] })
    },
  })

  return (
    <main>
      <h1>Quadros</h1>

      {podeCriar && (
        <form
          onSubmit={(evento) => {
            evento.preventDefault()
            criarMutation.mutate()
          }}
        >
          <label htmlFor="nome-quadro">Nome</label>
          <input id="nome-quadro" value={nome} onChange={(evento) => setNome(evento.target.value)} required />

          <label htmlFor="projeto-quadro">Projeto (id)</label>
          <input
            id="projeto-quadro"
            value={projetoId}
            onChange={(evento) => setProjetoId(evento.target.value)}
          />

          <label htmlFor="equipe-quadro">Equipe (id)</label>
          <input id="equipe-quadro" value={equipeId} onChange={(evento) => setEquipeId(evento.target.value)} />

          <button type="submit" disabled={criarMutation.isPending}>
            Criar quadro
          </button>
          {criarMutation.isError && <p>Não foi possível criar o quadro.</p>}
        </form>
      )}

      {quadrosQuery.isPending && <p>Carregando…</p>}
      {quadrosQuery.isError && <p>Não foi possível carregar os quadros.</p>}
      {quadrosQuery.data?.length === 0 && <p>Nenhum quadro visível ainda.</p>}
      <ul>
        {quadrosQuery.data?.map((quadro) => (
          <li key={quadro.id}>{quadro.nome}</li>
        ))}
      </ul>
    </main>
  )
}
