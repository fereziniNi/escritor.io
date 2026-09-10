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
import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router'
import { useAuthStore } from '../auth/authStore'
import { CampoPessoa } from '../../shared/CampoPessoa'
import { encontrarPessoaPorNome, existeSugestaoPara, type PessoaBasica } from '../../shared/encontrarPessoaPorNome'
import { formatarDataHoraBr } from '../../shared/formatarData'
import { formatarHms } from '../../shared/formatarHms'
import { adicionarMembroAoProjeto, buscarProjeto, criarColuna, listarPessoas } from '../organizacao/api'
import { ROTULO_STATUS_PROJETO, type ProjetoDetalhe } from '../organizacao/types'
import {
  buscarCronometro,
  criarCard,
  criarComentario,
  finalizarCronometro,
  iniciarCronometro,
  listarComentarios,
  listarEventos,
  moverCard,
  pausarCronometro,
} from './api'
import { rotuloEvento } from './rotuloEvento'
import { moverCardOtimista } from './moverCardOtimista'
import { resolverMovimento } from './resolverMovimento'
import type { Card, ColunaComCards } from './types'
import { useProjetoWebSocket } from './useProjetoWebSocket'
import './Kanban.css'

/**
 * Pedido do usuário: "está muito complexo... facilite o front" - antes cada card tinha 3 botões
 * de expandir separados (Apontamentos/Comentários/Histórico), cada um com sua própria lista/
 * formulário sempre "espalhados" no board. Agora os três só existem dentro de `DetalhesDoCard`
 * (um único toggle), então nenhum deles busca/renderiza nada por conta própria - montar já é o
 * gatilho de "está aberto" (mesmo espírito do lazy-fetch de antes, só que a fonte da verdade
 * agora é o pai, não um `aberto` próprio de cada um).
 */
function ComentariosSecao({ cardId }: { cardId: number }) {
  const queryClient = useQueryClient()
  const [texto, setTexto] = useState('')

  const comentariosQuery = useQuery({ queryKey: ['cards', cardId, 'comentarios'], queryFn: () => listarComentarios(cardId) })

  const criarComentarioMutation = useMutation({
    mutationFn: criarComentario,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cards', cardId, 'comentarios'] })
      setTexto('')
    },
  })

  return (
    <div className="kanban-subsecao">
      <h3 className="kanban-subsecao-titulo">💬 Comentários</h3>
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
  )
}

/**
 * Volta a ser só `listarEventos` (pedido do usuário: cronômetro substitui o apontamento manual) -
 * os 3 eventos novos de cronômetro (`INICIOU_TRABALHO`/`PAUSOU_TRABALHO`/`FINALIZOU_TRABALHO`,
 * gravados por `CronometroSecao` via backend) já aparecem sozinhos nesta mesma lista, cronológica,
 * com dia/hora (`formatarDataHoraBr`) na frente de cada item - sem precisar mesclar duas fontes.
 */
function HistoricoSecao({ cardId }: { cardId: number }) {
  const eventosQuery = useQuery({ queryKey: ['cards', cardId, 'eventos'], queryFn: () => listarEventos(cardId) })

  return (
    <div className="kanban-subsecao">
      <h3 className="kanban-subsecao-titulo">🕘 Histórico</h3>
      {eventosQuery.isError && <p className="mensagem-erro">Não foi possível carregar o histórico.</p>}
      <ul aria-label="Histórico do card" className="kanban-subsecao-lista">
        {eventosQuery.data?.map((evento) => (
          <li key={evento.id} className="kanban-subsecao-item">
            <span className="kanban-historico-quando">{formatarDataHoraBr(evento.criadoEm)}</span> — {rotuloEvento(evento)}
          </li>
        ))}
      </ul>
    </div>
  )
}

/**
 * Pedido do usuário: "deixe somente um contador de tempo onde a pessoa inicia, pausa e finaliza e
 * descreve o que foi feito quando finaliza a tarefa" - substitui o antigo apontamento manual
 * (lançamentos soltos, editáveis/excluíveis) por um cronômetro único por card. A descrição só é
 * pedida UMA VEZ, ao Finalizar, cobrindo a tarefa inteira - não mais uma por lançamento. Mesmo
 * cálculo de relógio ao vivo que `CronometroTrabalho` (Ponto) já usa: total fechado
 * (`totalMinutosFechados`, em minutos) + segundos decorridos desde `iniciadoEm`, só enquanto há
 * uma sessão aberta agora.
 */
function CronometroSecao({ cardId }: { cardId: number }) {
  const queryClient = useQueryClient()
  const [finalizando, setFinalizando] = useState(false)
  const [descricaoConclusao, setDescricaoConclusao] = useState('')

  const cronometroQuery = useQuery({ queryKey: ['cards', cardId, 'cronometro'], queryFn: () => buscarCronometro(cardId) })

  function invalidar() {
    queryClient.invalidateQueries({ queryKey: ['cards', cardId, 'cronometro'] })
    queryClient.invalidateQueries({ queryKey: ['cards', cardId, 'eventos'] })
    // Widget global do canto superior direito (`CronometroTarefaAtiva`) - reage na hora em vez de
    // esperar o próprio refetchInterval dele.
    queryClient.invalidateQueries({ queryKey: ['cronometro-ativo'] })
  }

  const iniciarMutation = useMutation({ mutationFn: () => iniciarCronometro(cardId), onSuccess: invalidar })
  const pausarMutation = useMutation({ mutationFn: () => pausarCronometro(cardId), onSuccess: invalidar })
  const finalizarMutation = useMutation({
    mutationFn: () => finalizarCronometro(cardId, descricaoConclusao),
    onSuccess: () => {
      invalidar()
      setFinalizando(false)
      setDescricaoConclusao('')
    },
  })

  const dados = cronometroQuery.data
  const emAndamento = dados?.iniciadoEm != null

  const [agora, setAgora] = useState(() => Date.now())
  useEffect(() => {
    if (!emAndamento) {
      return undefined
    }
    const id = setInterval(() => setAgora(Date.now()), 1000)
    return () => clearInterval(id)
  }, [emAndamento])

  if (cronometroQuery.isPending) {
    return null
  }
  if (cronometroQuery.isError || !dados) {
    return <p className="mensagem-erro">Não foi possível carregar o cronômetro.</p>
  }

  const jaTrabalhouAntes = dados.totalMinutosFechados > 0 || emAndamento
  let segundosTotais = dados.totalMinutosFechados * 60
  if (emAndamento && dados.iniciadoEm) {
    segundosTotais += Math.max(0, Math.floor((agora - new Date(dados.iniciadoEm).getTime()) / 1000))
  }

  return (
    <div className="kanban-subsecao">
      <h3 className="kanban-subsecao-titulo">⏱️ Cronômetro</h3>

      {dados.concluidoEm !== null ? (
        <div className="kanban-cronometro-concluido">
          <span className="kanban-cronometro-relogio" role="timer" aria-label="Tempo trabalhado nesta tarefa">
            {formatarHms(dados.totalMinutosFechados * 60)}
          </span>
          <p className="kanban-subsecao-item">✅ {dados.descricaoConclusao}</p>
        </div>
      ) : (
        <>
          {jaTrabalhouAntes && (
            <div className="kanban-cronometro-relogio" role="timer" aria-label="Tempo trabalhado nesta tarefa">
              {formatarHms(segundosTotais)}
            </div>
          )}
          <div className="linha-botoes">
            {!emAndamento && (
              <button
                type="button"
                className="botao-pequeno"
                onClick={() => iniciarMutation.mutate()}
                disabled={iniciarMutation.isPending}
              >
                ▶️ {jaTrabalhouAntes ? 'Retomar' : 'Iniciar'}
              </button>
            )}
            {emAndamento && (
              <button
                type="button"
                className="botao-secundario botao-pequeno"
                onClick={() => pausarMutation.mutate()}
                disabled={pausarMutation.isPending}
              >
                ⏸️ Pausar
              </button>
            )}
            <button type="button" className="botao-pequeno" onClick={() => setFinalizando(true)} disabled={finalizarMutation.isPending}>
              ✅ Finalizar
            </button>
          </div>
          {(iniciarMutation.isError || pausarMutation.isError) && (
            <p className="mensagem-erro">Não foi possível atualizar o cronômetro.</p>
          )}
        </>
      )}

      {finalizando && (
        <form
          className="formulario"
          onSubmit={(evento) => {
            evento.preventDefault()
            finalizarMutation.mutate()
          }}
        >
          <div className="campo">
            <label htmlFor={`descricao-conclusao-${cardId}`}>O que foi feito</label>
            <textarea
              id={`descricao-conclusao-${cardId}`}
              value={descricaoConclusao}
              onChange={(evento) => setDescricaoConclusao(evento.target.value)}
              required
            />
          </div>
          <div className="campo-acoes">
            <button type="submit" className="botao-pequeno" disabled={finalizarMutation.isPending}>
              Confirmar
            </button>
            <button type="button" className="botao-secundario botao-pequeno" onClick={() => setFinalizando(false)}>
              Cancelar
            </button>
          </div>
          {finalizarMutation.isError && <p className="mensagem-erro">Não foi possível finalizar a tarefa.</p>}
        </form>
      )}
    </div>
  )
}

/**
 * Pedido do usuário: "está muito complexo... facilite o front" - um único toggle no lugar dos três
 * que existiam antes (Apontamentos/Comentários/Histórico cada um com seu próprio botão).
 *
 * `abrirInicialmente` existe pro widget global do cronômetro ativo (canto superior direito,
 * `CronometroTarefaAtiva`): clicar nele navega direto até o card certo já com "Detalhes"
 * expandido, e rola a tela até ele (senão poderia abrir expandido fora da área visível num board
 * com muitas colunas/cards).
 */
function DetalhesDoCard({ cardId, abrirInicialmente = false }: { cardId: number; abrirInicialmente?: boolean }) {
  const [aberto, setAberto] = useState(abrirInicialmente)
  const divRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // `scrollIntoView` não existe no jsdom dos testes (nem em navegadores bem antigos) - checagem
    // defensiva em vez de deixar estourar.
    if (abrirInicialmente && typeof divRef.current?.scrollIntoView === 'function') {
      divRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
    // só na montagem - é um "abrir e rolar uma vez", não algo que deva repetir a cada re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="kanban-detalhes" ref={divRef}>
      <button type="button" className="kanban-detalhes-botao" onClick={() => setAberto((atual) => !atual)}>
        <span className={`kanban-detalhes-seta${aberto ? ' kanban-detalhes-seta-aberta' : ''}`} aria-hidden="true">
          ▸
        </span>
        {aberto ? 'Ocultar detalhes' : 'Detalhes'}
      </button>
      {aberto && (
        <div className="kanban-detalhes-corpo">
          <CronometroSecao cardId={cardId} />
          <ComentariosSecao cardId={cardId} />
          <HistoricoSecao cardId={cardId} />
        </div>
      )}
    </div>
  )
}

function CardArrastavel({
  card,
  nomeDoResponsavel,
  cardIdParaAbrir,
}: {
  card: Card
  nomeDoResponsavel: string | null
  cardIdParaAbrir?: number
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

  return (
    <li ref={setNodeRef} style={style} className="kanban-card">
      {/* Handle de arrastar isolado num elemento próprio: {...attributes} inclui role="button" do
      dnd-kit, e colocar isso no <li> inteiro (que também contém o resto do card) aninharia
      elementos interativos dentro de um role="button" - ARIA inválido que faz o nome acessível do
      card "engolir" o aria-label dos botões filhos (confirmado num browser real, não pego pelo
      jsdom dos testes de componente). */}
      <span className="kanban-card-titulo" {...attributes} {...listeners}>
        {card.titulo}
      </span>
      {(nomeDoResponsavel || card.estimativaMinutos !== null) && (
        <p className="kanban-card-meta">
          {nomeDoResponsavel && <span className="badge badge-neutro">👤 {nomeDoResponsavel}</span>}
          {card.estimativaMinutos !== null && <span className="badge badge-neutro">⏱️ {card.estimativaMinutos} min</span>}
        </p>
      )}
      <DetalhesDoCard cardId={card.id} abrirInicialmente={card.id === cardIdParaAbrir} />
    </li>
  )
}

function ColunaComDrop({
  coluna,
  pessoas,
  nomePorUsuarioId,
  novoCard,
  onNovoCardChange,
  onCriarCard,
  criandoCard,
  cardIdParaAbrir,
}: {
  coluna: ColunaComCards
  pessoas: PessoaBasica[]
  nomePorUsuarioId: Map<number, string>
  novoCard: { titulo: string; responsavelNome: string; estimativaMinutos: string }
  onNovoCardChange: (valor: { titulo: string; responsavelNome: string; estimativaMinutos: string }) => void
  onCriarCard: () => void
  criandoCard: boolean
  cardIdParaAbrir?: number
}) {
  const { setNodeRef } = useDroppable({ id: `coluna-${coluna.id}`, data: { type: 'coluna', colunaId: coluna.id } })
  // Substring, não nome exato: "b" enquanto o usuário ainda está digitando "Beto Lima" (que
  // `CampoPessoa` já sugere no dropdown) não deve acender "Pessoa não encontrada" - só quando não
  // sobra candidato nenhum.
  const responsavelNaoEncontrado = !existeSugestaoPara(pessoas, novoCard.responsavelNome)

  return (
    <section ref={setNodeRef} className="kanban-coluna">
      <div className="kanban-coluna-cabecalho">
        <h2 className="kanban-coluna-titulo">
          {coluna.nome}
          {coluna.limiteWip !== null && (
            <span className="badge">
              {' '}
              {coluna.cards.length}/{coluna.limiteWip}
            </span>
          )}
        </h2>
        {/* Barra decorativa só - o badge de texto acima continua sendo a fonte confiável (leitor
        de tela/teste), isto aqui é só o toque "gameficado" pedido (barra de progresso tipo WIP). */}
        {coluna.limiteWip !== null && (
          <div className="kanban-coluna-progresso" aria-hidden="true">
            <div
              className="kanban-coluna-progresso-preenchido"
              style={{ width: `${Math.min(100, (coluna.cards.length / coluna.limiteWip) * 100)}%` }}
            />
          </div>
        )}
      </div>
      <SortableContext items={coluna.cards.map((card) => card.id)} strategy={verticalListSortingStrategy}>
        <ul className="kanban-cards">
          {coluna.cards.map((card) => (
            <CardArrastavel
              key={card.id}
              card={card}
              nomeDoResponsavel={card.responsavelId === null ? null : (nomePorUsuarioId.get(card.responsavelId) ?? null)}
              cardIdParaAbrir={cardIdParaAbrir}
            />
          ))}
        </ul>
      </SortableContext>

      <form
        className="kanban-nova-tarefa-form"
        onSubmit={(evento) => {
          evento.preventDefault()
          onCriarCard()
        }}
      >
        <label htmlFor={`titulo-card-${coluna.id}`} className="sr-only">
          Nova tarefa
        </label>
        <input
          id={`titulo-card-${coluna.id}`}
          className="kanban-card-form-titulo"
          value={novoCard.titulo}
          onChange={(evento) => onNovoCardChange({ ...novoCard, titulo: evento.target.value })}
          placeholder="+ Nova tarefa"
          required
        />
        <div className="kanban-card-form-linha">
          <CampoPessoa
            id={`responsavel-card-${coluna.id}`}
            label="Nome do responsável (opcional)"
            labelSrOnly
            valor={novoCard.responsavelNome}
            aoMudarValor={(texto) => onNovoCardChange({ ...novoCard, responsavelNome: texto })}
            pessoas={pessoas}
            placeholder="Responsável"
          />
          <label htmlFor={`estimativa-card-${coluna.id}`} className="sr-only">
            Tempo estimado em minutos (opcional)
          </label>
          <input
            id={`estimativa-card-${coluna.id}`}
            type="number"
            className="kanban-card-form-estimativa"
            value={novoCard.estimativaMinutos}
            onChange={(evento) => onNovoCardChange({ ...novoCard, estimativaMinutos: evento.target.value })}
            placeholder="Min."
          />
          <button type="submit" className="botao-pequeno" disabled={criandoCard}>
            Adicionar tarefa
          </button>
        </div>
        {responsavelNaoEncontrado && <span className="mensagem-erro">Pessoa não encontrada</span>}
      </form>
    </section>
  )
}

/**
 * Pedido do cliente: sem Equipe/Quadro separado - pessoas são atribuídas direto ao projeto (o
 * "sistema"). Adicionar é por nome (pedido: "referenciar o nome dela e não o ID... a pessoa
 * preenchendo o nome e já aparecer as pessoas cadastradas ou Pessoa não encontrada") - a lista de
 * sugestões vem de TODAS as pessoas cadastradas (`GET /usuarios/basico`), não só de quem já é
 * membro, porque atribuir alguém que ainda não é membro é justamente o caso de uso daqui.
 */
function MembrosDoProjeto({
  projetoId,
  membros,
  pessoas,
  podeGerenciar,
}: {
  projetoId: number
  membros: { usuarioId: number; usuarioNome: string }[]
  pessoas: PessoaBasica[]
  podeGerenciar: boolean
}) {
  const queryClient = useQueryClient()
  const [nomeDigitado, setNomeDigitado] = useState('')

  const pessoaEncontrada = encontrarPessoaPorNome(pessoas, nomeDigitado)
  // Mesmo raciocínio de `responsavelNaoEncontrado` acima: substring, não nome exato, senão a
  // mensagem aparece atrás do próprio dropdown de sugestões enquanto o nome ainda está incompleto.
  const naoEncontrada = !existeSugestaoPara(pessoas, nomeDigitado)

  const adicionarMutation = useMutation({
    mutationFn: () => adicionarMembroAoProjeto({ projetoId, usuarioId: pessoaEncontrada!.id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projetos', projetoId] })
      setNomeDigitado('')
    },
  })

  return (
    <section className="secao cartao kanban-membros">
      <h2 className="secao-titulo">👥 Membros do projeto</h2>
      {membros.length === 0 && <p className="mensagem-vazia">Nenhum membro ainda.</p>}
      {membros.length > 0 && (
        <ul className="kanban-membros-lista">
          {membros.map((membro) => (
            <li key={membro.usuarioId} className="badge">
              {membro.usuarioNome}
            </li>
          ))}
        </ul>
      )}
      {podeGerenciar && (
        <form
          className="kanban-card-form"
          onSubmit={(evento) => {
            evento.preventDefault()
            if (pessoaEncontrada) {
              adicionarMutation.mutate()
            }
          }}
        >
          <CampoPessoa
            id="nome-membro"
            label="Adicionar membro (nome)"
            labelSrOnly
            valor={nomeDigitado}
            aoMudarValor={setNomeDigitado}
            pessoas={pessoas}
            placeholder="Nome da pessoa"
            obrigatorio
          />
          <button type="submit" className="botao-pequeno" disabled={adicionarMutation.isPending || !pessoaEncontrada}>
            ➕ Adicionar membro
          </button>
        </form>
      )}
      {naoEncontrada && <p className="mensagem-erro">Pessoa não encontrada</p>}
      {adicionarMutation.isError && <p className="mensagem-erro">Não foi possível adicionar o membro.</p>}
    </section>
  )
}

/**
 * Pedido do cliente: "o admin pode adicionar as seções de um projeto (a fazer, fazendo, feito,
 * revisão, testando)" - antes só existia a coluna seedada por padrão ("A fazer"), sem nenhuma
 * forma de acrescentar outras pelo frontend (o endpoint `POST /projetos/{id}/colunas` já existia
 * no backend, só faltava a tela). `ordem` é calculada aqui a partir das colunas já carregadas -
 * o backend rejeita duas colunas com a mesma ordem no mesmo projeto.
 *
 * Apesar do nome ("admin pode"), a permissão nunca foi restrita a ADMIN de fato - nasceu GESTOR/
 * ADMIN e depois, a pedido do usuário ("Um funcionário pode adicionar seções e também adicionar
 * novos projetos"), abriu pra qualquer autenticado - `ProjetoDetalhePage` não passa mais nenhuma
 * prop de permissão pra este componente, ele sempre renderiza.
 */
function NovaColuna({ projetoId, proximaOrdem }: { projetoId: number; proximaOrdem: number }) {
  const queryClient = useQueryClient()
  const [aberto, setAberto] = useState(false)
  const [nome, setNome] = useState('')

  const criarMutation = useMutation({
    mutationFn: () => criarColuna({ projetoId, nome, ordem: proximaOrdem }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projetos', projetoId] })
      setNome('')
      setAberto(false)
    },
  })

  if (!aberto) {
    return (
      <button type="button" className="botao-secundario kanban-nova-coluna-botao" onClick={() => setAberto(true)}>
        ➕ Nova seção
      </button>
    )
  }

  return (
    <section className="kanban-coluna kanban-nova-coluna">
      <form
        className="formulario formulario-largo"
        onSubmit={(evento) => {
          evento.preventDefault()
          criarMutation.mutate()
        }}
      >
        <div className="campo">
          <label htmlFor="nome-nova-secao">Nome da seção</label>
          <input
            id="nome-nova-secao"
            value={nome}
            onChange={(evento) => setNome(evento.target.value)}
            placeholder="Ex.: Revisão, Testando..."
            required
            autoFocus
          />
        </div>
        <div className="campo-acoes">
          <button type="submit" className="botao-pequeno" disabled={criarMutation.isPending}>
            Adicionar
          </button>
          <button
            type="button"
            className="botao-secundario botao-pequeno"
            onClick={() => {
              setAberto(false)
              setNome('')
            }}
          >
            Cancelar
          </button>
        </div>
      </form>
      {criarMutation.isError && <p className="mensagem-erro">Não foi possível criar a seção.</p>}
    </section>
  )
}

const NOVO_CARD_VAZIO = { titulo: '', responsavelNome: '', estimativaMinutos: '' }

/**
 * `projetoIdProp` é opcional - só existe pro `PainelProjetos` (dock do Escritório, "uma tela só")
 * poder passar o id direto, sem precisar de uma rota `/projetos/:id` de verdade. `useParams()`
 * continua sendo chamado incondicionalmente (regra dos hooks), só o resultado é ignorado quando
 * `projetoIdProp` vem preenchido. `cardIdParaAbrir` é o mesmo tipo de atalho, pro widget global do
 * cronômetro ativo (`CronometroTarefaAtiva`) abrir direto no card certo com "Detalhes" expandido.
 */
export function ProjetoDetalhePage({
  projetoIdProp,
  cardIdParaAbrir,
}: { projetoIdProp?: number; cardIdParaAbrir?: number } = {}) {
  const { id } = useParams()
  const projetoId = projetoIdProp ?? Number(id)
  const queryClient = useQueryClient()
  const papel = useAuthStore((estado) => estado.papel)
  // Pedido do usuário: "Um funcionário pode adicionar seções e também adicionar novos projetos" -
  // adicionar seção deixou de ser GESTOR/ADMIN e virou qualquer autenticado (mesma mudança em
  // `POST /projetos/{id}/colunas` no backend, `ProjetoController` - `@PreAuthorize` removido de
  // lá). Adicionar MEMBRO não foi mencionado no pedido - continua GESTOR/ADMIN, então precisa
  // continuar como uma permissão separada da de seção (as duas eram a mesma variável antes).
  const podeAdicionarMembro = papel === 'GESTOR' || papel === 'ADMIN'

  const [novoCardPorColuna, setNovoCardPorColuna] = useState<Record<number, typeof NOVO_CARD_VAZIO>>({})

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const projetoQuery = useQuery({
    queryKey: ['projetos', projetoId],
    queryFn: () => buscarProjeto(projetoId),
  })

  // Pedido do cliente: sugestões de nome (membro do projeto ou responsável de tarefa) vêm de
  // TODAS as pessoas cadastradas, não só de quem já é membro do projeto - atribuir alguém que
  // ainda não é membro é um caso de uso legítimo (ex.: primeira tarefa de alguém no projeto).
  const pessoasQuery = useQuery({
    queryKey: ['pessoas'],
    queryFn: listarPessoas,
  })
  const pessoas = pessoasQuery.data ?? []

  // S3.11: quando outro usuário arrasta um card neste projeto, o backend broadcasta pelo
  // websocket e este hook invalida a query acima - o projeto atualiza sem reload manual.
  useProjetoWebSocket(projetoId)

  const criarCardMutation = useMutation({
    mutationFn: criarCard,
    onSuccess: (_dados, variaveis) => {
      queryClient.invalidateQueries({ queryKey: ['projetos', projetoId] })
      setNovoCardPorColuna((atual) => ({ ...atual, [variaveis.colunaId]: NOVO_CARD_VAZIO }))
    },
  })

  const moverCardMutation = useMutation({
    mutationFn: moverCard,
    onMutate: async (variaveis) => {
      await queryClient.cancelQueries({ queryKey: ['projetos', projetoId] })
      const anterior = queryClient.getQueryData<ProjetoDetalhe>(['projetos', projetoId])
      if (anterior) {
        queryClient.setQueryData<ProjetoDetalhe>(
          ['projetos', projetoId],
          moverCardOtimista(anterior, variaveis.cardId, variaveis.colunaId, variaveis.indice),
        )
      }
      return { anterior }
    },
    onError: (_erro, _variaveis, contexto) => {
      if (contexto?.anterior) {
        queryClient.setQueryData(['projetos', projetoId], contexto.anterior)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['projetos', projetoId] })
    },
  })

  function handleDragEnd(evento: DragEndEvent) {
    const { active, over } = evento
    const dadosAtivo = active.data.current as { type: 'card'; cardId: number; colunaId: number } | undefined
    if (!dadosAtivo || !projetoQuery.data) {
      return
    }

    const dadosAlvo = over?.data.current as
      | { type: 'coluna'; colunaId: number }
      | { type: 'card'; colunaId: number; cardId: number }
      | undefined

    const movimento = resolverMovimento(projetoQuery.data.colunas, dadosAtivo.cardId, dadosAlvo)
    if (!movimento) {
      return
    }

    moverCardMutation.mutate({ cardId: dadosAtivo.cardId, colunaId: movimento.colunaId, indice: movimento.indice })
  }

  if (projetoQuery.isPending) {
    return <p className="mensagem-carregando">Carregando…</p>
  }

  if (projetoQuery.isError) {
    return <p className="mensagem-erro">Não foi possível carregar o projeto.</p>
  }

  const projeto = projetoQuery.data
  // Membros do projeto entram primeiro, pessoas cadastradas sobrescrevem/completam depois - assim
  // um responsável de tarefa que ainda não é membro do projeto também aparece corretamente no
  // card enquanto `pessoasQuery` ainda não terminou de carregar.
  const nomePorUsuarioId = new Map<number, string>(projeto.membros.map((membro) => [membro.usuarioId, membro.usuarioNome]))
  pessoas.forEach((pessoa) => nomePorUsuarioId.set(pessoa.id, pessoa.nome))
  const totalTarefas = projeto.colunas.reduce((total, coluna) => total + coluna.cards.length, 0)

  return (
    <main className="pagina" style={{ maxWidth: 'none' }}>
      <div className="kanban-projeto-cabecalho">
        <span className="kanban-projeto-icone" aria-hidden="true">
          📋
        </span>
        <h1>{projeto.nome}</h1>
        <span className="badge">{ROTULO_STATUS_PROJETO[projeto.status]}</span>
      </div>

      {/* Pedido do usuário: "deixe mais técnico" - números do projeto à vista, sem precisar contar
      card por coluna. Reaproveita `.grade-stats`/`.stat-cartao`, já usado em Jornada de hoje
      (ponto), pra manter a mesma linguagem visual em vez de inventar uma nova. */}
      <div className="grade-stats kanban-projeto-stats">
        <div className="stat-cartao">
          <div className="stat-cartao-rotulo">Cliente</div>
          <div className="stat-cartao-valor kanban-projeto-stat-texto">{projeto.cliente}</div>
        </div>
        <div className="stat-cartao">
          <div className="stat-cartao-rotulo">Tarefas</div>
          <div className="stat-cartao-valor">{totalTarefas}</div>
        </div>
        <div className="stat-cartao">
          <div className="stat-cartao-rotulo">Membros</div>
          <div className="stat-cartao-valor">{projeto.membros.length}</div>
        </div>
      </div>

      <MembrosDoProjeto projetoId={projetoId} membros={projeto.membros} pessoas={pessoas} podeGerenciar={podeAdicionarMembro} />

      {projeto.colunas.length === 0 && <p className="mensagem-vazia">Nenhuma coluna neste projeto ainda.</p>}

      {moverCardMutation.isError && <p className="mensagem-erro">Não foi possível mover o card.</p>}
      {criarCardMutation.isError && <p className="mensagem-erro">Não foi possível criar a tarefa.</p>}

      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
        <div className="kanban-board">
        {projeto.colunas.map((coluna) => (
          <ColunaComDrop
            key={coluna.id}
            coluna={coluna}
            pessoas={pessoas}
            nomePorUsuarioId={nomePorUsuarioId}
            novoCard={novoCardPorColuna[coluna.id] ?? NOVO_CARD_VAZIO}
            cardIdParaAbrir={cardIdParaAbrir}
            onNovoCardChange={(valor) => setNovoCardPorColuna((atual) => ({ ...atual, [coluna.id]: valor }))}
            onCriarCard={() => {
              const dados = novoCardPorColuna[coluna.id] ?? NOVO_CARD_VAZIO
              const responsavel = encontrarPessoaPorNome(pessoas, dados.responsavelNome)
              criarCardMutation.mutate({
                colunaId: coluna.id,
                titulo: dados.titulo,
                responsavelId: responsavel ? responsavel.id : null,
                estimativaMinutos: dados.estimativaMinutos === '' ? null : Number(dados.estimativaMinutos),
              })
            }}
            criandoCard={criarCardMutation.isPending}
          />
        ))}
        {/* Qualquer autenticado pode adicionar seção agora (pedido do usuário) - sem checagem de
        papel aqui, diferente de `MembrosDoProjeto` acima. */}
        <NovaColuna
          projetoId={projetoId}
          proximaOrdem={projeto.colunas.reduce((maior, coluna) => Math.max(maior, coluna.ordem), -1) + 1}
        />
        </div>
      </DndContext>
    </main>
  )
}
