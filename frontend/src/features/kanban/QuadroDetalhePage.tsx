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
import { useEffect, useState } from 'react'
import { useParams } from 'react-router'
import { useAuthStore } from '../auth/authStore'
import {
  aplicarEtiqueta,
  buscarQuadro,
  criarCard,
  criarComentario,
  criarEtiqueta,
  iniciarTimer,
  listarComentarios,
  listarEtiquetas,
  listarEventos,
  moverCard,
  pararTimer,
  removerEtiqueta,
} from './api'
import { formatarDuracao } from './formatarDuracao'
import { moverCardOtimista } from './moverCardOtimista'
import { resolverMovimento } from './resolverMovimento'
import { rotuloEvento } from './rotuloEvento'
import type { Card, ColunaComCards, Etiqueta, QuadroDetalhe } from './types'
import { useQuadroWebSocket } from './useQuadroWebSocket'

function ComentariosDoCard({ cardId }: { cardId: number }) {
  const queryClient = useQueryClient()
  const [aberto, setAberto] = useState(false)
  const [texto, setTexto] = useState('')

  // Só busca quando expandido - evitar um GET por card só de renderizar o quadro, mesmo espírito
  // do N+1 já assumido em QuadroService.paraColunaComCards (S3.14).
  const comentariosQuery = useQuery({
    queryKey: ['cards', cardId, 'comentarios'],
    queryFn: () => listarComentarios(cardId),
    enabled: aberto,
  })

  const criarComentarioMutation = useMutation({
    mutationFn: criarComentario,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cards', cardId, 'comentarios'] })
      setTexto('')
    },
  })

  return (
    <div>
      <button type="button" onClick={() => setAberto((atual) => !atual)}>
        Comentários
      </button>
      {aberto && (
        <div>
          {comentariosQuery.isError && <p>Não foi possível carregar os comentários.</p>}
          <ul>
            {comentariosQuery.data?.map((comentario) => (
              <li key={comentario.id}>{comentario.texto}</li>
            ))}
          </ul>
          <form
            onSubmit={(evento) => {
              evento.preventDefault()
              criarComentarioMutation.mutate({ cardId, texto })
            }}
          >
            <label htmlFor={`novo-comentario-${cardId}`}>Novo comentário</label>
            <textarea
              id={`novo-comentario-${cardId}`}
              value={texto}
              onChange={(evento) => setTexto(evento.target.value)}
              required
            />
            <button type="submit" disabled={criarComentarioMutation.isPending}>
              Comentar
            </button>
            {criarComentarioMutation.isError && <p>Não foi possível comentar.</p>}
          </form>
        </div>
      )}
    </div>
  )
}

function HistoricoDoCard({ cardId }: { cardId: number }) {
  const [aberto, setAberto] = useState(false)

  // Mesma lógica de lazy-fetch de ComentariosDoCard: só busca quando o painel está aberto.
  const eventosQuery = useQuery({
    queryKey: ['cards', cardId, 'eventos'],
    queryFn: () => listarEventos(cardId),
    enabled: aberto,
  })

  return (
    <div>
      <button type="button" onClick={() => setAberto((atual) => !atual)}>
        Histórico
      </button>
      {aberto && (
        <div>
          {eventosQuery.isError && <p>Não foi possível carregar o histórico.</p>}
          <ul aria-label="Histórico do card">
            {eventosQuery.data?.map((evento) => (
              <li key={evento.id}>{rotuloEvento(evento)}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function TimerDoCard({ cardId }: { cardId: number }) {
  // Estado só local de propósito (S4.4): não há endpoint ainda pra "qual timer está aberto" (fica
  // pra quando precisar), então um reload da página perde a referência de qual apontamento está
  // rodando aqui - o timer continua aberto no servidor, só a UI "esquece" até essa fatia futura.
  const [apontamentoAtivo, setApontamentoAtivo] = useState<{ id: number; inicio: string } | null>(null)
  const [agora, setAgora] = useState(() => Date.now())

  useEffect(() => {
    if (!apontamentoAtivo) {
      return undefined
    }
    const intervalo = setInterval(() => setAgora(Date.now()), 1000)
    return () => clearInterval(intervalo)
  }, [apontamentoAtivo])

  const iniciarMutation = useMutation({
    mutationFn: () => iniciarTimer(cardId),
    onSuccess: (apontamento) => {
      setApontamentoAtivo({ id: apontamento.id, inicio: apontamento.inicio })
      setAgora(Date.now())
    },
  })

  const pararMutation = useMutation({
    mutationFn: () => pararTimer(apontamentoAtivo!.id),
    onSuccess: () => setApontamentoAtivo(null),
    // Se o servidor recusar (ex.: esse timer já foi encerrado por outro iniciado em outro card -
    // S4.2/S4.3), a suposição local de "ainda está rodando" já era falsa mesmo - some daqui.
    onError: () => setApontamentoAtivo(null),
  })

  if (!apontamentoAtivo) {
    return (
      <div>
        <button type="button" onClick={() => iniciarMutation.mutate()} disabled={iniciarMutation.isPending}>
          Iniciar timer
        </button>
        {iniciarMutation.isError && <p>Não foi possível iniciar o timer.</p>}
        {/* pararMutation também pode ter errado sem apontamentoAtivo: onError já zerou o
        estado antes desta renderização, e a mensagem precisa sobreviver a essa troca de branch. */}
        {pararMutation.isError && <p>Não foi possível parar o timer.</p>}
      </div>
    )
  }

  const segundosDecorridos = (agora - new Date(apontamentoAtivo.inicio).getTime()) / 1000

  return (
    <div>
      <span>{formatarDuracao(segundosDecorridos)}</span>
      <button type="button" onClick={() => pararMutation.mutate()} disabled={pararMutation.isPending}>
        Parar timer
      </button>
    </div>
  )
}

function CardArrastavel({
  card,
  etiquetasDisponiveis,
  etiquetaSelecionada,
  onEtiquetaSelecionadaChange,
  onAplicarEtiqueta,
  onRemoverEtiqueta,
}: {
  card: Card
  etiquetasDisponiveis: Etiqueta[]
  etiquetaSelecionada: string
  onEtiquetaSelecionadaChange: (valor: string) => void
  onAplicarEtiqueta: () => void
  onRemoverEtiqueta: (etiquetaId: number) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
    data: { type: 'card', colunaId: card.colunaId, cardId: card.id },
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const idsJaAplicados = new Set(card.etiquetas.map((etiqueta) => etiqueta.id))
  const etiquetasParaAplicar = etiquetasDisponiveis.filter((etiqueta) => !idsJaAplicados.has(etiqueta.id))

  return (
    <li ref={setNodeRef} style={style}>
      {/* Handle de arrastar isolado num elemento próprio: {...attributes} inclui role="button" do
      dnd-kit, e colocar isso no <li> inteiro (que também contém o select/botões de etiqueta)
      aninharia elementos interativos dentro de um role="button" - ARIA inválido que faz o nome
      acessível do card "engolir" o aria-label dos botões filhos (confirmado num browser real,
      não pego pelo jsdom dos testes de componente). */}
      <span {...attributes} {...listeners}>
        {card.titulo}
      </span>
      <ul>
        {card.etiquetas.map((etiqueta) => (
          <li key={etiqueta.id} style={{ backgroundColor: etiqueta.cor, display: 'inline-block' }}>
            {etiqueta.nome}
            <button type="button" aria-label={`Remover ${etiqueta.nome}`} onClick={() => onRemoverEtiqueta(etiqueta.id)}>
              ×
            </button>
          </li>
        ))}
      </ul>
      {etiquetasParaAplicar.length > 0 && (
        <div>
          <label htmlFor={`aplicar-etiqueta-${card.id}`}>Aplicar etiqueta</label>
          <select
            id={`aplicar-etiqueta-${card.id}`}
            value={etiquetaSelecionada}
            onChange={(evento) => onEtiquetaSelecionadaChange(evento.target.value)}
          >
            <option value="">Selecione…</option>
            {etiquetasParaAplicar.map((etiqueta) => (
              <option key={etiqueta.id} value={etiqueta.id}>
                {etiqueta.nome}
              </option>
            ))}
          </select>
          <button type="button" disabled={etiquetaSelecionada === ''} onClick={onAplicarEtiqueta}>
            Aplicar
          </button>
        </div>
      )}
      <TimerDoCard cardId={card.id} />
      <ComentariosDoCard cardId={card.id} />
      <HistoricoDoCard cardId={card.id} />
    </li>
  )
}

function ColunaComDrop({
  coluna,
  etiquetasDisponiveis,
  etiquetaSelecionadaPorCard,
  onEtiquetaSelecionadaChange,
  onAplicarEtiqueta,
  onRemoverEtiqueta,
  tituloNovoCard,
  onTituloChange,
  onCriarCard,
  criandoCard,
}: {
  coluna: ColunaComCards
  etiquetasDisponiveis: Etiqueta[]
  etiquetaSelecionadaPorCard: Record<number, string>
  onEtiquetaSelecionadaChange: (cardId: number, valor: string) => void
  onAplicarEtiqueta: (cardId: number) => void
  onRemoverEtiqueta: (cardId: number, etiquetaId: number) => void
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
            <CardArrastavel
              key={card.id}
              card={card}
              etiquetasDisponiveis={etiquetasDisponiveis}
              etiquetaSelecionada={etiquetaSelecionadaPorCard[card.id] ?? ''}
              onEtiquetaSelecionadaChange={(valor) => onEtiquetaSelecionadaChange(card.id, valor)}
              onAplicarEtiqueta={() => onAplicarEtiqueta(card.id)}
              onRemoverEtiqueta={(etiquetaId) => onRemoverEtiqueta(card.id, etiquetaId)}
            />
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
  const papel = useAuthStore((estado) => estado.papel)
  const podeCriarEtiqueta = papel === 'GESTOR' || papel === 'ADMIN'

  const [tituloPorColuna, setTituloPorColuna] = useState<Record<number, string>>({})
  const [etiquetaSelecionadaPorCard, setEtiquetaSelecionadaPorCard] = useState<Record<number, string>>({})
  const [nomeEtiqueta, setNomeEtiqueta] = useState('')
  const [corEtiqueta, setCorEtiqueta] = useState('')

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const quadroQuery = useQuery({
    queryKey: ['quadros', quadroId],
    queryFn: () => buscarQuadro(quadroId),
  })

  const etiquetasQuery = useQuery({
    queryKey: ['quadros', quadroId, 'etiquetas'],
    queryFn: () => listarEtiquetas(quadroId),
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

  const criarEtiquetaMutation = useMutation({
    mutationFn: criarEtiqueta,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quadros', quadroId, 'etiquetas'] })
      setNomeEtiqueta('')
      setCorEtiqueta('')
    },
  })

  const aplicarEtiquetaMutation = useMutation({
    mutationFn: aplicarEtiqueta,
    onSuccess: (_dados, variaveis) => {
      queryClient.invalidateQueries({ queryKey: ['quadros', quadroId] })
      setEtiquetaSelecionadaPorCard((atual) => ({ ...atual, [variaveis.cardId]: '' }))
    },
  })

  const removerEtiquetaMutation = useMutation({
    mutationFn: removerEtiqueta,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quadros', quadroId] })
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
  const etiquetasDisponiveis = etiquetasQuery.data ?? []

  return (
    <main>
      <h1>{quadro.nome}</h1>

      {podeCriarEtiqueta && (
        <form
          onSubmit={(evento) => {
            evento.preventDefault()
            criarEtiquetaMutation.mutate({ quadroId, nome: nomeEtiqueta, cor: corEtiqueta })
          }}
        >
          <label htmlFor="nome-etiqueta">Nome da etiqueta</label>
          <input id="nome-etiqueta" value={nomeEtiqueta} onChange={(evento) => setNomeEtiqueta(evento.target.value)} required />

          <label htmlFor="cor-etiqueta">Cor da etiqueta</label>
          <input id="cor-etiqueta" value={corEtiqueta} onChange={(evento) => setCorEtiqueta(evento.target.value)} required />

          <button type="submit" disabled={criarEtiquetaMutation.isPending}>
            Criar etiqueta
          </button>
          {criarEtiquetaMutation.isError && <p>Não foi possível criar a etiqueta.</p>}
        </form>
      )}

      {quadro.colunas.length === 0 && <p>Nenhuma coluna neste quadro ainda.</p>}

      {moverCardMutation.isError && <p>Não foi possível mover o card.</p>}
      {aplicarEtiquetaMutation.isError && <p>Não foi possível aplicar a etiqueta.</p>}
      {removerEtiquetaMutation.isError && <p>Não foi possível remover a etiqueta.</p>}

      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
        {quadro.colunas.map((coluna) => (
          <ColunaComDrop
            key={coluna.id}
            coluna={coluna}
            etiquetasDisponiveis={etiquetasDisponiveis}
            etiquetaSelecionadaPorCard={etiquetaSelecionadaPorCard}
            onEtiquetaSelecionadaChange={(cardId, valor) =>
              setEtiquetaSelecionadaPorCard((atual) => ({ ...atual, [cardId]: valor }))
            }
            onAplicarEtiqueta={(cardId) => {
              const etiquetaId = Number(etiquetaSelecionadaPorCard[cardId])
              if (etiquetaId) {
                aplicarEtiquetaMutation.mutate({ cardId, etiquetaId })
              }
            }}
            onRemoverEtiqueta={(cardId, etiquetaId) => removerEtiquetaMutation.mutate({ cardId, etiquetaId })}
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
