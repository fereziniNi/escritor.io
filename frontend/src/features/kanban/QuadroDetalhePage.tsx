import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useParams } from 'react-router'
import { buscarQuadro, criarCard } from './api'

export function QuadroDetalhePage() {
  const { id } = useParams()
  const quadroId = Number(id)
  const queryClient = useQueryClient()
  const [tituloPorColuna, setTituloPorColuna] = useState<Record<number, string>>({})

  const quadroQuery = useQuery({
    queryKey: ['quadros', quadroId],
    queryFn: () => buscarQuadro(quadroId),
  })

  const criarCardMutation = useMutation({
    mutationFn: criarCard,
    onSuccess: (_dados, variaveis) => {
      queryClient.invalidateQueries({ queryKey: ['quadros', quadroId] })
      setTituloPorColuna((atual) => ({ ...atual, [variaveis.colunaId]: '' }))
    },
  })

  if (quadroQuery.isPending) {
    return <p>Carregando…</p>
  }

  if (quadroQuery.isError) {
    return <p>Não foi possível carregar o quadro.</p>
  }

  const quadro = quadroQuery.data

  return (
    <main>
      <h1>{quadro.nome}</h1>

      {quadro.colunas.length === 0 && <p>Nenhuma coluna neste quadro ainda.</p>}

      {quadro.colunas.map((coluna) => (
        <section key={coluna.id}>
          <h2>{coluna.nome}</h2>
          <ul>
            {coluna.cards.map((card) => (
              <li key={card.id}>{card.titulo}</li>
            ))}
          </ul>

          <form
            onSubmit={(evento) => {
              evento.preventDefault()
              criarCardMutation.mutate({ colunaId: coluna.id, titulo: tituloPorColuna[coluna.id] ?? '' })
            }}
          >
            <label htmlFor={`titulo-card-${coluna.id}`}>Novo card</label>
            <input
              id={`titulo-card-${coluna.id}`}
              value={tituloPorColuna[coluna.id] ?? ''}
              onChange={(evento) =>
                setTituloPorColuna((atual) => ({ ...atual, [coluna.id]: evento.target.value }))
              }
              required
            />
            <button type="submit" disabled={criarCardMutation.isPending}>
              Adicionar card
            </button>
          </form>
        </section>
      ))}
    </main>
  )
}
