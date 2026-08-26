import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { criarEquipe, listarEquipes } from './api'

export function EquipesPage() {
  const queryClient = useQueryClient()
  const [nome, setNome] = useState('')
  const [descricao, setDescricao] = useState('')

  const equipesQuery = useQuery({ queryKey: ['equipes'], queryFn: listarEquipes })

  const criarMutation = useMutation({
    mutationFn: () => criarEquipe(nome, descricao),
    onSuccess: () => {
      setNome('')
      setDescricao('')
      queryClient.invalidateQueries({ queryKey: ['equipes'] })
    },
  })

  return (
    <main>
      <h1>Equipes</h1>

      <form
        onSubmit={(evento) => {
          evento.preventDefault()
          criarMutation.mutate()
        }}
      >
        <label htmlFor="nome-equipe">Nome</label>
        <input id="nome-equipe" value={nome} onChange={(evento) => setNome(evento.target.value)} required />

        <label htmlFor="descricao-equipe">Descrição</label>
        <input
          id="descricao-equipe"
          value={descricao}
          onChange={(evento) => setDescricao(evento.target.value)}
        />

        <button type="submit" disabled={criarMutation.isPending}>
          Criar equipe
        </button>
        {criarMutation.isError && <p>Não foi possível criar a equipe.</p>}
      </form>

      {equipesQuery.isPending && <p>Carregando…</p>}
      {equipesQuery.isError && <p>Não foi possível carregar as equipes.</p>}
      <ul>
        {equipesQuery.data?.map((equipe) => (
          <li key={equipe.id}>{equipe.nome}</li>
        ))}
      </ul>
    </main>
  )
}
