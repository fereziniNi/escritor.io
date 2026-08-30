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
  criarApontamentoManual,
  criarCard,
  criarComentario,
  criarEtiqueta,
  editarApontamento,
  excluirApontamento,
  iniciarTimer,
  listarApontamentos,
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
import type { Apontamento, Card, ColunaComCards, Etiqueta, QuadroDetalhe } from './types'
import { useQuadroWebSocket } from './useQuadroWebSocket'
import './Kanban.css'

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
    <div className="kanban-subsecao">
      <button type="button" className="botao-secundario botao-pequeno" onClick={() => setAberto((atual) => !atual)}>
        💬 Comentários
      </button>
      {aberto && (
        <div className="kanban-subsecao-corpo">
          {comentariosQuery.isError && <p className="mensagem-erro">Não foi possível carregar os comentários.</p>}
          {comentariosQuery.data && comentariosQuery.data.length > 0 && (
            <ul className="kanban-subsecao-lista">
              {comentariosQuery.data.map((comentario) => (
                <li key={comentario.id} className="kanban-subsecao-item">
                  {comentario.texto}
                </li>
              ))}
            </ul>
          )}
          <form
            className="kanban-card-form"
            onSubmit={(evento) => {
              evento.preventDefault()
              criarComentarioMutation.mutate({ cardId, texto })
            }}
          >
            <label htmlFor={`novo-comentario-${cardId}`} className="sr-only">
              Novo comentário
            </label>
            <textarea
              id={`novo-comentario-${cardId}`}
              value={texto}
              onChange={(evento) => setTexto(evento.target.value)}
              placeholder="Novo comentário"
              required
            />
            <button type="submit" className="botao-pequeno" disabled={criarComentarioMutation.isPending}>
              Comentar
            </button>
          </form>
          {criarComentarioMutation.isError && <p className="mensagem-erro">Não foi possível comentar.</p>}
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
    <div className="kanban-subsecao">
      <button type="button" className="botao-secundario botao-pequeno" onClick={() => setAberto((atual) => !atual)}>
        🕘 Histórico
      </button>
      {aberto && (
        <div className="kanban-subsecao-corpo">
          {eventosQuery.isError && <p className="mensagem-erro">Não foi possível carregar o histórico.</p>}
          <ul aria-label="Histórico do card" className="kanban-subsecao-lista">
            {eventosQuery.data?.map((evento) => (
              <li key={evento.id} className="kanban-subsecao-item">
                {rotuloEvento(evento)}
              </li>
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
      <div className="kanban-timer">
        <button type="button" className="botao-pequeno" onClick={() => iniciarMutation.mutate()} disabled={iniciarMutation.isPending}>
          ▶️ Iniciar timer
        </button>
        {iniciarMutation.isError && <p className="mensagem-erro">Não foi possível iniciar o timer.</p>}
        {/* pararMutation também pode ter errado sem apontamentoAtivo: onError já zerou o
        estado antes desta renderização, e a mensagem precisa sobreviver a essa troca de branch. */}
        {pararMutation.isError && <p className="mensagem-erro">Não foi possível parar o timer.</p>}
      </div>
    )
  }

  const segundosDecorridos = (agora - new Date(apontamentoAtivo.inicio).getTime()) / 1000

  return (
    <div className="kanban-timer">
      <span className="kanban-timer-cronometro">⏱️ {formatarDuracao(segundosDecorridos)}</span>
      <button type="button" className="botao-perigo botao-pequeno" onClick={() => pararMutation.mutate()} disabled={pararMutation.isPending}>
        ⏹️ Parar timer
      </button>
    </div>
  )
}

function LinhaApontamento({
  apontamento,
  emEdicao,
  onIniciarEdicao,
  onCancelarEdicao,
  onSalvarEdicao,
  salvandoEdicao,
  onExcluir,
}: {
  apontamento: Apontamento
  emEdicao: boolean
  onIniciarEdicao: () => void
  onCancelarEdicao: () => void
  onSalvarEdicao: (minutos: string, descricao: string) => void
  salvandoEdicao: boolean
  onExcluir: () => void
}) {
  const [minutos, setMinutos] = useState(String(apontamento.minutos ?? ''))
  const [descricao, setDescricao] = useState(apontamento.descricao ?? '')

  if (emEdicao) {
    return (
      <li className="kanban-subsecao-item">
        <form
          className="formulario"
          onSubmit={(evento) => {
            evento.preventDefault()
            onSalvarEdicao(minutos, descricao)
          }}
        >
          {/* fim (e portanto minutos) só existe pra apontamento já encerrado - PATCH /apontamentos/{id}
          nunca aceita minutos direto (S4.6), então editar duração aqui recalcula fim a partir do
          inicio original + minutos novos, mantendo o inicio intocado. Timer ainda aberto (fim nulo)
          não tem duração pra editar ainda, só descrição. */}
          {apontamento.fim !== null && (
            <div className="campo">
              <label htmlFor={`minutos-edicao-${apontamento.id}`}>Minutos</label>
              <input
                id={`minutos-edicao-${apontamento.id}`}
                type="number"
                value={minutos}
                onChange={(evento) => setMinutos(evento.target.value)}
                required
              />
            </div>
          )}
          <div className="campo">
            <label htmlFor={`descricao-edicao-${apontamento.id}`}>Descrição</label>
            <input id={`descricao-edicao-${apontamento.id}`} value={descricao} onChange={(evento) => setDescricao(evento.target.value)} />
          </div>
          <div className="campo-acoes">
            <button type="submit" className="botao-pequeno" disabled={salvandoEdicao}>
              Salvar
            </button>
            <button type="button" className="botao-secundario botao-pequeno" onClick={onCancelarEdicao}>
              Cancelar
            </button>
          </div>
        </form>
      </li>
    )
  }

  return (
    <li className="kanban-subsecao-item">
      <span>{apontamento.minutos !== null ? `${apontamento.minutos} min` : 'em andamento'}</span>
      {apontamento.descricao && <span> — {apontamento.descricao}</span>}
      <div className="linha-botoes" style={{ marginTop: '0.35rem' }}>
        <button type="button" className="botao-secundario botao-pequeno" onClick={onIniciarEdicao}>
          Editar
        </button>
        <button type="button" className="botao-perigo botao-pequeno" aria-label={`Excluir apontamento ${apontamento.id}`} onClick={onExcluir}>
          🗑️
        </button>
      </div>
    </li>
  )
}

function ApontamentosDoCard({ cardId }: { cardId: number }) {
  const queryClient = useQueryClient()
  const [aberto, setAberto] = useState(false)
  const [editandoId, setEditandoId] = useState<number | null>(null)
  const [minutosManual, setMinutosManual] = useState('')
  const [descricaoManual, setDescricaoManual] = useState('')

  // Mesma lógica de lazy-fetch de ComentariosDoCard/HistoricoDoCard.
  const apontamentosQuery = useQuery({
    queryKey: ['cards', cardId, 'apontamentos'],
    queryFn: () => listarApontamentos(cardId),
    enabled: aberto,
  })

  const criarManualMutation = useMutation({
    mutationFn: criarApontamentoManual,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cards', cardId, 'apontamentos'] })
      setMinutosManual('')
      setDescricaoManual('')
    },
  })

  const editarMutation = useMutation({
    mutationFn: editarApontamento,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cards', cardId, 'apontamentos'] })
      setEditandoId(null)
    },
  })

  const excluirMutation = useMutation({
    mutationFn: excluirApontamento,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cards', cardId, 'apontamentos'] })
    },
  })

  return (
    <div className="kanban-subsecao">
      <button type="button" className="botao-secundario botao-pequeno" onClick={() => setAberto((atual) => !atual)}>
        🧾 Apontamentos
      </button>
      {aberto && (
        <div className="kanban-subsecao-corpo">
          {apontamentosQuery.isError && <p className="mensagem-erro">Não foi possível carregar os apontamentos.</p>}
          <ul aria-label="Apontamentos do card" className="kanban-subsecao-lista">
            {apontamentosQuery.data?.map((apontamento) => (
              <LinhaApontamento
                key={apontamento.id}
                apontamento={apontamento}
                emEdicao={editandoId === apontamento.id}
                onIniciarEdicao={() => setEditandoId(apontamento.id)}
                onCancelarEdicao={() => setEditandoId(null)}
                salvandoEdicao={editarMutation.isPending}
                onSalvarEdicao={(minutos, descricao) => {
                  const novosMinutos = Number(minutos)
                  const novoFim =
                    apontamento.fim !== null
                      ? new Date(new Date(apontamento.inicio).getTime() + novosMinutos * 60_000).toISOString()
                      : null
                  editarMutation.mutate({ apontamentoId: apontamento.id, inicio: null, fim: novoFim, descricao: descricao || null })
                }}
                onExcluir={() => excluirMutation.mutate(apontamento.id)}
              />
            ))}
          </ul>
          {editarMutation.isError && <p className="mensagem-erro">Não foi possível editar o apontamento.</p>}
          {excluirMutation.isError && <p className="mensagem-erro">Não foi possível excluir o apontamento.</p>}

          <form
            className="formulario"
            onSubmit={(evento) => {
              evento.preventDefault()
              criarManualMutation.mutate({
                cardId,
                inicio: null,
                fim: null,
                minutos: Number(minutosManual),
                descricao: descricaoManual || null,
              })
            }}
          >
            <div className="campo">
              <label htmlFor={`minutos-manual-${cardId}`}>Minutos trabalhados</label>
              <input
                id={`minutos-manual-${cardId}`}
                type="number"
                value={minutosManual}
                onChange={(evento) => setMinutosManual(evento.target.value)}
                required
              />
            </div>
            <div className="campo">
              <label htmlFor={`descricao-manual-${cardId}`}>Descrição</label>
              <input id={`descricao-manual-${cardId}`} value={descricaoManual} onChange={(evento) => setDescricaoManual(evento.target.value)} />
            </div>
            <div className="campo-acoes">
              <button type="submit" className="botao-pequeno" disabled={criarManualMutation.isPending}>
                Lançar
              </button>
              {criarManualMutation.isError && <p className="mensagem-erro">Não foi possível lançar o apontamento.</p>}
            </div>
          </form>
        </div>
      )}
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
    <li ref={setNodeRef} style={style} className="kanban-card">
      {/* Handle de arrastar isolado num elemento próprio: {...attributes} inclui role="button" do
      dnd-kit, e colocar isso no <li> inteiro (que também contém o select/botões de etiqueta)
      aninharia elementos interativos dentro de um role="button" - ARIA inválido que faz o nome
      acessível do card "engolir" o aria-label dos botões filhos (confirmado num browser real,
      não pego pelo jsdom dos testes de componente). */}
      <span className="kanban-card-titulo" {...attributes} {...listeners}>
        {card.titulo}
      </span>
      {card.etiquetas.length > 0 && (
        <ul className="kanban-etiquetas">
          {card.etiquetas.map((etiqueta) => (
            <li key={etiqueta.id} className="kanban-etiqueta" style={{ backgroundColor: etiqueta.cor }}>
              {etiqueta.nome}
              <button type="button" aria-label={`Remover ${etiqueta.nome}`} onClick={() => onRemoverEtiqueta(etiqueta.id)}>
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      {etiquetasParaAplicar.length > 0 && (
        <div className="kanban-aplicar-etiqueta">
          <label htmlFor={`aplicar-etiqueta-${card.id}`} className="sr-only">
            Aplicar etiqueta
          </label>
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
          <button type="button" className="botao-pequeno" disabled={etiquetaSelecionada === ''} onClick={onAplicarEtiqueta}>
            Aplicar
          </button>
        </div>
      )}
      <TimerDoCard cardId={card.id} />
      <ApontamentosDoCard cardId={card.id} />
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
    <section ref={setNodeRef} className="kanban-coluna">
      <h2 className="kanban-coluna-titulo">
        {coluna.nome}
        {coluna.limiteWip !== null && (
          <span className="badge">
            {' '}
            {coluna.cards.length}/{coluna.limiteWip}
          </span>
        )}
      </h2>
      <SortableContext items={coluna.cards.map((card) => card.id)} strategy={verticalListSortingStrategy}>
        <ul className="kanban-cards">
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
        className="kanban-card-form"
        onSubmit={(evento) => {
          evento.preventDefault()
          onCriarCard()
        }}
      >
        <label htmlFor={`titulo-card-${coluna.id}`} className="sr-only">
          Novo card
        </label>
        <input
          id={`titulo-card-${coluna.id}`}
          value={tituloNovoCard}
          onChange={(evento) => onTituloChange(evento.target.value)}
          placeholder="+ Novo card"
          required
        />
        <button type="submit" className="botao-pequeno" disabled={criandoCard}>
          Adicionar card
        </button>
      </form>
    </section>
  )
}

/**
 * `quadroIdProp` é opcional - só existe pro `PainelKanban` (dock do Escritório, "uma tela só")
 * poder passar o id direto, sem precisar de uma rota `/kanban/:id` de verdade. `useParams()`
 * continua sendo chamado incondicionalmente (regra dos hooks), só o resultado é ignorado quando
 * `quadroIdProp` vem preenchido.
 */
export function QuadroDetalhePage({ quadroIdProp }: { quadroIdProp?: number } = {}) {
  const { id } = useParams()
  const quadroId = quadroIdProp ?? Number(id)
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
    return <p className="mensagem-carregando">Carregando…</p>
  }

  if (quadroQuery.isError) {
    return <p className="mensagem-erro">Não foi possível carregar o quadro.</p>
  }

  const quadro = quadroQuery.data
  const etiquetasDisponiveis = etiquetasQuery.data ?? []

  return (
    <main className="pagina" style={{ maxWidth: 'none' }}>
      <div className="kanban-quadro-cabecalho">
        <span className="kanban-quadro-icone" aria-hidden="true">
          📋
        </span>
        <h1>{quadro.nome}</h1>
      </div>

      {podeCriarEtiqueta && (
        <form
          className="secao cartao kanban-etiqueta-form"
          onSubmit={(evento) => {
            evento.preventDefault()
            criarEtiquetaMutation.mutate({ quadroId, nome: nomeEtiqueta, cor: corEtiqueta })
          }}
        >
          <div className="campo">
            <label htmlFor="nome-etiqueta">Nome da etiqueta</label>
            <input id="nome-etiqueta" value={nomeEtiqueta} onChange={(evento) => setNomeEtiqueta(evento.target.value)} required />
          </div>

          <div className="campo">
            <label htmlFor="cor-etiqueta">Cor da etiqueta</label>
            <input id="cor-etiqueta" value={corEtiqueta} onChange={(evento) => setCorEtiqueta(evento.target.value)} required />
          </div>

          <div className="campo-acoes" style={{ gridColumn: 'unset' }}>
            <button type="submit" disabled={criarEtiquetaMutation.isPending}>
              🏷️ Criar etiqueta
            </button>
          </div>
          {criarEtiquetaMutation.isError && <p className="mensagem-erro">Não foi possível criar a etiqueta.</p>}
        </form>
      )}

      {quadro.colunas.length === 0 && <p className="mensagem-vazia">Nenhuma coluna neste quadro ainda.</p>}

      {moverCardMutation.isError && <p className="mensagem-erro">Não foi possível mover o card.</p>}
      {aplicarEtiquetaMutation.isError && <p className="mensagem-erro">Não foi possível aplicar a etiqueta.</p>}
      {removerEtiquetaMutation.isError && <p className="mensagem-erro">Não foi possível remover a etiqueta.</p>}

      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
        <div className="kanban-board">
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
        </div>
      </DndContext>
    </main>
  )
}
