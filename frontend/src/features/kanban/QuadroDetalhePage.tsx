import {
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useParams } from 'react-router'
import { buscarQuadro, criarCard, moverCard } from './api'
import { moverCardOtimista } from './moverCardOtimista'
import { resolverMovimento } from './resolverMovimento'
import type { Card, ColunaComCards, QuadroDetalhe } from './types'
import { useQuadroWebSocket } from './useQuadroWebSocket'

function CardArrastavel({ card }: { card: Card }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
    data: { type: 'card', colunaId: card.colunaId, cardId: card.id },
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <li ref={setNodeRef} style={style} {...attributes} {...listeners}>
      {card.titulo}
    </li>
  )
}

function ColunaComDrop({
  coluna,
  tituloNovoCard,
  onTituloChange,
  onCriarCard,
  criandoCard,
}: {
  coluna: ColunaComCards
  tituloNovoCard: string
  onTituloChange: (valor: string) => void
  onCriarCard: () => void
  criandoCard: boolean
}) {
  const { setNodeRef } = useDroppable({ id: `coluna-${coluna.id}`, data: { type: 'coluna', colunaId: coluna.id } })

  return (
    <section ref={setNodeRef}>
      <h2>
        {coluna.nome}
        {coluna.limiteWip !== null && (
          <span>
            {' '}
            {coluna.cards.length}/{coluna.limiteWip}
          </span>
        )}
      </h2>
      <SortableContext items={coluna.cards.map((card) => card.id)} strategy={verticalListSortingStrategy}>
        <ul>
          {coluna.cards.map((card) => (
            <CardArrastavel key={card.id} card={card} />
          ))}
        </ul>
      </SortableContext>

      <form
        onSubmit={(evento) => {
          evento.preventDefault()
          onCriarCard()
        }}
      >
        <label htmlFor={`titulo-card-${coluna.id}`}>Novo card</label>
        <input
          id={`titulo-card-${coluna.id}`}
          value={tituloNovoCard}
          onChange={(evento) => onTituloChange(evento.target.value)}
          required
        />
        <button type="submit" disabled={criandoCard}>
          Adicionar card
        </button>
      </form>
    </section>
  )
}

export function QuadroDetalhePage() {
  const { id } = useParams()
  const quadroId = Number(id)
  const queryClient = useQueryClient()
  const [tituloPorColuna, setTituloPorColuna] = useState<Record<number, string>>({})

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const quadroQuery = useQuery({
    queryKey: ['quadros', quadroId],
    queryFn: () => buscarQuadro(quadroId),
  })

  // S3.11: quando outro usuário arrasta um card neste quadro, o backend broadcasta pelo
  // websocket e este hook invalida a query acima - o quadro atualiza sem reload manual.
  useQuadroWebSocket(quadroId)

  const criarCardMutation = useMutation({
    mutationFn: criarCard,
    onSuccess: (_dados, variaveis) => {
      queryClient.invalidateQueries({ queryKey: ['quadros', quadroId] })
      setTituloPorColuna((atual) => ({ ...atual, [variaveis.colunaId]: '' }))
    },
  })

  const moverCardMutation = useMutation({
    mutationFn: moverCard,
    onMutate: async (variaveis) => {
      await queryClient.cancelQueries({ queryKey: ['quadros', quadroId] })
      const anterior = queryClient.getQueryData<QuadroDetalhe>(['quadros', quadroId])
      if (anterior) {
        queryClient.setQueryData<QuadroDetalhe>(
          ['quadros', quadroId],
          moverCardOtimista(anterior, variaveis.cardId, variaveis.colunaId, variaveis.indice),
        )
      }
      return { anterior }
    },
    onError: (_erro, _variaveis, contexto) => {
      if (contexto?.anterior) {
        queryClient.setQueryData(['quadros', quadroId], contexto.anterior)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['quadros', quadroId] })
    },
  })

  function handleDragEnd(evento: DragEndEvent) {
    const { active, over } = evento
    const dadosAtivo = active.data.current as { type: 'card'; cardId: number; colunaId: number } | undefined
    if (!dadosAtivo || !quadroQuery.data) {
      return
    }

    const dadosAlvo = over?.data.current as
      | { type: 'coluna'; colunaId: number }
      | { type: 'card'; colunaId: number; cardId: number }
      | undefined

    const movimento = resolverMovimento(quadroQuery.data.colunas, dadosAtivo.cardId, dadosAlvo)
    if (!movimento) {
      return
    }

    moverCardMutation.mutate({ cardId: dadosAtivo.cardId, colunaId: movimento.colunaId, indice: movimento.indice })
  }

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

      {moverCardMutation.isError && <p>Não foi possível mover o card.</p>}

      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
        {quadro.colunas.map((coluna) => (
          <ColunaComDrop
            key={coluna.id}
            coluna={coluna}
            tituloNovoCard={tituloPorColuna[coluna.id] ?? ''}
            onTituloChange={(valor) => setTituloPorColuna((atual) => ({ ...atual, [coluna.id]: valor }))}
            onCriarCard={() =>
              criarCardMutation.mutate({ colunaId: coluna.id, titulo: tituloPorColuna[coluna.id] ?? '' })
            }
            criandoCard={criarCardMutation.isPending}
          />
        ))}
      </DndContext>
    </main>
  )
}
