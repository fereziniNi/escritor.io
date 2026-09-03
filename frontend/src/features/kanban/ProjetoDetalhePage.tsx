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
import { useAuthStore } from '../auth/authStore'
import { CampoPessoa } from '../../shared/CampoPessoa'
import { encontrarPessoaPorNome, existeSugestaoPara, type PessoaBasica } from '../../shared/encontrarPessoaPorNome'
import { formatarDataHoraBr } from '../../shared/formatarData'
import { adicionarMembroAoProjeto, buscarProjeto, criarColuna, listarPessoas } from '../organizacao/api'
import { ROTULO_STATUS_PROJETO, type ProjetoDetalhe } from '../organizacao/types'
import {
  criarApontamentoManual,
  criarCard,
  criarComentario,
  editarApontamento,
  excluirApontamento,
  listarApontamentos,
  listarComentarios,
  listarEventos,
  moverCard,
} from './api'
import { mesclarHistorico } from './mesclarHistorico'
import { moverCardOtimista } from './moverCardOtimista'
import { resolverMovimento } from './resolverMovimento'
import type { Apontamento, Card, ColunaComCards } from './types'
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
 * Pedido do usuário: "eu iniciei o timer de uma atividade... mas ela não ficou marcada no
 * historico!! no historico deve estar o dia hora e quanto tempo foi feita" - o Histórico mostrava
 * só os eventos de ciclo de vida do card (`EventoCard`), nunca o tempo apontado. Agora mescla
 * eventos com apontamentos (`mesclarHistorico`) numa única linha do tempo, com dia/hora
 * (`formatarDataHoraBr`) na frente de cada item. Reaproveita a MESMA queryKey de
 * `ApontamentosSecao` (`['cards', cardId, 'apontamentos']`) de propósito - é o cache
 * compartilhado do TanStack Query que faz o Histórico se atualizar sozinho quando um lançamento
 * manual é criado/editado/excluído, sem duplicar a busca nem inventar um canal de sincronização
 * novo.
 */
function HistoricoSecao({ cardId }: { cardId: number }) {
  const eventosQuery = useQuery({ queryKey: ['cards', cardId, 'eventos'], queryFn: () => listarEventos(cardId) })
  const apontamentosQuery = useQuery({ queryKey: ['cards', cardId, 'apontamentos'], queryFn: () => listarApontamentos(cardId) })

  const linhas = mesclarHistorico(eventosQuery.data ?? [], apontamentosQuery.data ?? [])

  return (
    <div className="kanban-subsecao">
      <h3 className="kanban-subsecao-titulo">🕘 Histórico</h3>
      {(eventosQuery.isError || apontamentosQuery.isError) && <p className="mensagem-erro">Não foi possível carregar o histórico.</p>}
      <ul aria-label="Histórico do card" className="kanban-subsecao-lista">
        {linhas.map((linha) => (
          <li key={linha.chave} className="kanban-subsecao-item">
            <span className="kanban-historico-quando">{formatarDataHoraBr(linha.quando)}</span> — {linha.rotulo}
          </li>
        ))}
      </ul>
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
          inicio original + minutos novos, mantendo o inicio intocado. Um eventual apontamento
          legado sem fim (de antes da remoção do "Iniciar timer") não tem duração pra editar
          ainda, só descrição. */}
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

function ApontamentosSecao({ cardId }: { cardId: number }) {
  const queryClient = useQueryClient()
  const [editandoId, setEditandoId] = useState<number | null>(null)
  const [minutosManual, setMinutosManual] = useState('')
  const [descricaoManual, setDescricaoManual] = useState('')

  const apontamentosQuery = useQuery({ queryKey: ['cards', cardId, 'apontamentos'], queryFn: () => listarApontamentos(cardId) })

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
      <h3 className="kanban-subsecao-titulo">🧾 Apontamentos</h3>
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
  )
}

/**
 * Pedido do usuário: "está muito complexo... facilite o front" - um único toggle no lugar dos três
 * que existiam antes (Apontamentos/Comentários/Histórico cada um com seu próprio botão).
 */
function DetalhesDoCard({ cardId }: { cardId: number }) {
  const [aberto, setAberto] = useState(false)

  return (
    <div className="kanban-detalhes">
      <button type="button" className="botao-secundario botao-pequeno kanban-detalhes-botao" onClick={() => setAberto((atual) => !atual)}>
        {aberto ? '🔼 Ocultar detalhes' : '🔽 Detalhes'}
      </button>
      {aberto && (
        <div className="kanban-detalhes-corpo">
          <ApontamentosSecao cardId={cardId} />
          <ComentariosSecao cardId={cardId} />
          <HistoricoSecao cardId={cardId} />
        </div>
      )}
    </div>
  )
}

function CardArrastavel({ card, nomeDoResponsavel }: { card: Card; nomeDoResponsavel: string | null }) {
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
      <DetalhesDoCard cardId={card.id} />
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
}: {
  coluna: ColunaComCards
  pessoas: PessoaBasica[]
  nomePorUsuarioId: Map<number, string>
  novoCard: { titulo: string; responsavelNome: string; estimativaMinutos: string }
  onNovoCardChange: (valor: { titulo: string; responsavelNome: string; estimativaMinutos: string }) => void
  onCriarCard: () => void
  criandoCard: boolean
}) {
  const { setNodeRef } = useDroppable({ id: `coluna-${coluna.id}`, data: { type: 'coluna', colunaId: coluna.id } })
  // Substring, não nome exato: "b" enquanto o usuário ainda está digitando "Beto Lima" (que
  // `CampoPessoa` já sugere no dropdown) não deve acender "Pessoa não encontrada" - só quando não
  // sobra candidato nenhum.
  const responsavelNaoEncontrado = !existeSugestaoPara(pessoas, novoCard.responsavelNome)

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
      {/* Barra decorativa só - o badge de texto acima continua sendo a fonte confiável (leitor de
      tela/teste), isto aqui é só o toque "gameficado" pedido (barra de progresso tipo WIP). */}
      {coluna.limiteWip !== null && (
        <div className="kanban-coluna-progresso" aria-hidden="true">
          <div
            className="kanban-coluna-progresso-preenchido"
            style={{ width: `${Math.min(100, (coluna.cards.length / coluna.limiteWip) * 100)}%` }}
          />
        </div>
      )}
      <SortableContext items={coluna.cards.map((card) => card.id)} strategy={verticalListSortingStrategy}>
        <ul className="kanban-cards">
          {coluna.cards.map((card) => (
            <CardArrastavel
              key={card.id}
              card={card}
              nomeDoResponsavel={card.responsavelId === null ? null : (nomePorUsuarioId.get(card.responsavelId) ?? null)}
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
          Nova tarefa
        </label>
        <input
          id={`titulo-card-${coluna.id}`}
          value={novoCard.titulo}
          onChange={(evento) => onNovoCardChange({ ...novoCard, titulo: evento.target.value })}
          placeholder="+ Nova tarefa"
          required
        />
        <CampoPessoa
          id={`responsavel-card-${coluna.id}`}
          label="Nome do responsável (opcional)"
          labelSrOnly
          valor={novoCard.responsavelNome}
          aoMudarValor={(texto) => onNovoCardChange({ ...novoCard, responsavelNome: texto })}
          pessoas={pessoas}
          placeholder="Nome do responsável"
        />
        {responsavelNaoEncontrado && <span className="mensagem-erro">Pessoa não encontrada</span>}
        <label htmlFor={`estimativa-card-${coluna.id}`} className="sr-only">
          Tempo estimado em minutos (opcional)
        </label>
        <input
          id={`estimativa-card-${coluna.id}`}
          type="number"
          value={novoCard.estimativaMinutos}
          onChange={(evento) => onNovoCardChange({ ...novoCard, estimativaMinutos: evento.target.value })}
          placeholder="Tempo estimado (min)"
        />
        <button type="submit" className="botao-pequeno" disabled={criandoCard}>
          Adicionar tarefa
        </button>
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
 * `projetoIdProp` vem preenchido.
 */
export function ProjetoDetalhePage({ projetoIdProp }: { projetoIdProp?: number } = {}) {
  const { id } = useParams()
  const projetoId = projetoIdProp ?? Number(id)
  const queryClient = useQueryClient()
  const papel = useAuthStore((estado) => estado.papel)
  // GESTOR/ADMIN: mesma permissão pra adicionar membro e pra adicionar seção (coluna) - ambas
  // `@PreAuthorize("hasAnyRole('GESTOR', 'ADMIN')")` no backend (`ProjetoController`).
  const podeGerenciarProjeto = papel === 'GESTOR' || papel === 'ADMIN'

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

      <MembrosDoProjeto projetoId={projetoId} membros={projeto.membros} pessoas={pessoas} podeGerenciar={podeGerenciarProjeto} />

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
        {podeGerenciarProjeto && (
          <NovaColuna
            projetoId={projetoId}
            proximaOrdem={projeto.colunas.reduce((maior, coluna) => Math.max(maior, coluna.ordem), -1) + 1}
          />
        )}
        </div>
      </DndContext>
    </main>
  )
}
