import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { setupServer } from 'msw/node'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { useAuthStore } from '../auth/authStore'
import { ProjetoDetalhePage } from './ProjetoDetalhePage'
import type { ColunaComCards, Cronometro } from './types'

// Pedido do cliente: sugestões de pessoa vêm de TODAS as pessoas cadastradas (`GET
// /usuarios/basico`), não só de quem já é membro do projeto - handler padrão restaurado a cada
// teste por `resetHandlers`, então todo teste tem essa lista disponível mesmo sem chamar
// `server.use` de novo.
const PESSOAS_CADASTRADAS = [
  { id: 1, nome: 'Ana Souza' },
  { id: 2, nome: 'Beto Lima' },
]

const CRONOMETRO_NUNCA_INICIADO: Cronometro = { cardId: 7, iniciadoEm: null, totalMinutosFechados: 0, descricaoConclusao: null, concluidoEm: null }

// Pedido do usuário: "está muito complexo... facilite o front" - Cronômetro/Comentários/
// Histórico agora vivem juntos atrás de um único toggle ("Detalhes"), então abrir o card sempre
// dispara os três GETs de uma vez (antes cada um só disparava com seu próprio toggle). Handlers
// padrão de lista vazia/cronômetro-nunca-iniciado pro card fixo desta suíte (id 7), restaurados a
// cada teste por `resetHandlers`; testes que precisam de dado de verdade sobrescrevem com
// `server.use(...)`.
const server = setupServer(
  http.get('/usuarios/basico', () => HttpResponse.json(PESSOAS_CADASTRADAS)),
  http.get('/cards/7/cronometro', () => HttpResponse.json(CRONOMETRO_NUNCA_INICIADO)),
  http.get('/cards/7/comentarios', () => HttpResponse.json([])),
  http.get('/cards/7/eventos', () => HttpResponse.json([])),
)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

const ESTADO_INICIAL = useAuthStore.getState()

beforeEach(() => {
  useAuthStore.setState(ESTADO_INICIAL, true)
  useAuthStore.getState().definirSessao('token-fake', 'COLABORADOR')
})

function renderPagina(cardIdParaAbrir?: number) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/projetos/1']}>
        <Routes>
          <Route path="/projetos/:id" element={<ProjetoDetalhePage cardIdParaAbrir={cardIdParaAbrir} />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const PROJETO_DETALHE = {
  id: 1,
  nome: 'Backlog',
  cliente: 'Cliente Teste',
  status: 'ATIVO',
  inicio: '2026-01-01',
  fimPrevisto: null,
  membros: [{ usuarioId: 1, usuarioNome: 'Ana Souza' }],
  colunas: [
    {
      id: 5,
      nome: 'A fazer',
      ordem: 0,
      limiteWip: null,
      cards: [
        {
          id: 7,
          colunaId: 5,
          titulo: 'Corrigir bug',
          descricao: null,
          posicao: 1024,
          responsavelId: null,
          prazo: null,
          estimativaMinutos: null,
          criadoPorId: 1,
          criadoEm: '2026-01-15T09:00:00Z',
          arquivado: false,
        },
      ],
    },
  ],
}

describe('ProjetoDetalhePage', () => {
  it('mostra o nome do projeto, as colunas e os cards', async () => {
    server.use(http.get('/projetos/1', () => HttpResponse.json(PROJETO_DETALHE)))

    renderPagina()

    expect(await screen.findByRole('heading', { name: 'Backlog' })).toBeInTheDocument()
    expect(screen.getByText('A fazer')).toBeInTheDocument()
    expect(screen.getByText('Corrigir bug')).toBeInTheDocument()
  })

  it('mostra status, cliente, total de tarefas e de membros no cabeçalho (pedido: "mais técnico")', async () => {
    server.use(http.get('/projetos/1', () => HttpResponse.json(PROJETO_DETALHE)))

    renderPagina()

    await screen.findByRole('heading', { name: 'Backlog' })
    expect(screen.getByText('Ativo')).toBeInTheDocument()
    expect(screen.getByText('Cliente Teste')).toBeInTheDocument()
    // "1" aparece duas vezes (1 tarefa E 1 membro) - escopado por card de estatística pra não dar
    // "múltiplos elementos encontrados".
    const cartaoTarefas = screen.getByText('Tarefas').closest('.stat-cartao')
    expect(within(cartaoTarefas as HTMLElement).getByText('1')).toBeInTheDocument()
  })

  it('mostra os membros do projeto', async () => {
    server.use(http.get('/projetos/1', () => HttpResponse.json(PROJETO_DETALHE)))

    renderPagina()

    expect(await screen.findByText('Ana Souza')).toBeInTheDocument()
  })

  it('colaborador não vê o formulário de adicionar membro', async () => {
    server.use(http.get('/projetos/1', () => HttpResponse.json(PROJETO_DETALHE)))

    renderPagina()

    await screen.findByText('Ana Souza')
    expect(screen.queryByRole('button', { name: /adicionar membro/i })).not.toBeInTheDocument()
  })

  it('gestor adiciona um membro ao projeto e ele aparece na lista sem reload manual', async () => {
    useAuthStore.getState().definirSessao('token-fake', 'GESTOR')
    let membros = PROJETO_DETALHE.membros
    server.use(
      http.get('/projetos/1', () => HttpResponse.json({ ...PROJETO_DETALHE, membros })),
      http.post('/projetos/1/membros', async ({ request }) => {
        const corpo = (await request.json()) as { usuarioId: number }
        membros = [...membros, { usuarioId: corpo.usuarioId, usuarioNome: 'Beto Lima' }]
        return new HttpResponse(null, { status: 204 })
      }),
    )
    const user = userEvent.setup()
    renderPagina()

    await screen.findByText('Ana Souza')
    // pedido do usuário: digita o nome, não o id - "Beto Lima" é sugerido porque está em
    // TODAS as pessoas cadastradas, mesmo ainda não sendo membro deste projeto.
    await user.type(screen.getByLabelText(/adicionar membro/i), 'Beto Lima')
    await user.click(screen.getByRole('button', { name: /adicionar membro/i }))

    expect(await screen.findByText('Beto Lima')).toBeInTheDocument()
  })

  it('nome que não é de nenhuma pessoa cadastrada mostra "Pessoa não encontrada" e não deixa adicionar', async () => {
    useAuthStore.getState().definirSessao('token-fake', 'GESTOR')
    server.use(http.get('/projetos/1', () => HttpResponse.json(PROJETO_DETALHE)))
    const user = userEvent.setup()
    renderPagina()

    await screen.findByText('Ana Souza')
    await user.type(screen.getByLabelText(/adicionar membro/i), 'Alguém que não existe')

    expect(await screen.findByText(/pessoa não encontrada/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /adicionar membro/i })).toBeDisabled()
  })

  it('nome parcial que ainda é candidato a alguém cadastrado não mostra "Pessoa não encontrada"', async () => {
    useAuthStore.getState().definirSessao('token-fake', 'GESTOR')
    server.use(http.get('/projetos/1', () => HttpResponse.json(PROJETO_DETALHE)))
    const user = userEvent.setup()
    renderPagina()

    await screen.findByText('Ana Souza')
    // "b" ainda pode virar "Beto Lima" - a mensagem de erro não deve aparecer atrás do próprio
    // dropdown de sugestões enquanto o nome está incompleto.
    await user.type(screen.getByLabelText(/adicionar membro/i), 'b')

    expect(await screen.findByText('Beto Lima')).toBeInTheDocument() // opção sugerida no dropdown
    expect(screen.queryByText(/pessoa não encontrada/i)).not.toBeInTheDocument()
  })

  it('cria uma tarefa na coluna certa e ela aparece sem reload manual', async () => {
    let colunas: ColunaComCards[] = PROJETO_DETALHE.colunas
    server.use(
      http.get('/projetos/1', () => HttpResponse.json({ ...PROJETO_DETALHE, colunas })),
      http.post('/colunas/5/cards', async ({ request }) => {
        const corpo = (await request.json()) as { titulo: string; responsavelId: number | null; estimativaMinutos: number | null }
        const novoCard = {
          id: 8,
          colunaId: 5,
          titulo: corpo.titulo,
          descricao: null,
          posicao: 2048,
          responsavelId: corpo.responsavelId,
          prazo: null,
          estimativaMinutos: corpo.estimativaMinutos,
          criadoPorId: 1,
          criadoEm: '2026-01-15T10:00:00Z',
          arquivado: false,
        }
        colunas = [{ ...colunas[0], cards: [...colunas[0].cards, novoCard] }]
        return HttpResponse.json(novoCard, { status: 201 })
      }),
    )
    const user = userEvent.setup()
    renderPagina()

    await screen.findByText('Corrigir bug')
    await user.type(screen.getByLabelText(/nova tarefa/i), 'Escrever testes')
    await user.click(screen.getByRole('button', { name: /adicionar tarefa/i }))

    expect(await screen.findByText('Escrever testes')).toBeInTheDocument()
  })

  it('cria uma tarefa com responsável (digitado pelo nome) e tempo estimado', async () => {
    let colunas: ColunaComCards[] = PROJETO_DETALHE.colunas
    server.use(
      http.get('/projetos/1', () => HttpResponse.json({ ...PROJETO_DETALHE, colunas })),
      http.post('/colunas/5/cards', async ({ request }) => {
        const corpo = (await request.json()) as { titulo: string; responsavelId: number | null; estimativaMinutos: number | null }
        expect(corpo.responsavelId).toBe(1)
        expect(corpo.estimativaMinutos).toBe(90)
        const novoCard = {
          id: 8,
          colunaId: 5,
          titulo: corpo.titulo,
          descricao: null,
          posicao: 2048,
          responsavelId: corpo.responsavelId,
          prazo: null,
          estimativaMinutos: corpo.estimativaMinutos,
          criadoPorId: 1,
          criadoEm: '2026-01-15T10:00:00Z',
          arquivado: false,
        }
        colunas = [{ ...colunas[0], cards: [...colunas[0].cards, novoCard] }]
        return HttpResponse.json(novoCard, { status: 201 })
      }),
    )
    const user = userEvent.setup()
    renderPagina()

    await screen.findByText('Corrigir bug')
    await user.type(screen.getByLabelText(/nova tarefa/i), 'Escrever testes')
    // pedido do usuário: digita o nome, não o id - a pessoa aparece como opção porque está em
    // TODAS as pessoas cadastradas (GET /usuarios/basico), não só entre os membros do projeto.
    await user.type(screen.getByLabelText(/nome do responsável/i), 'Ana Souza')
    await user.type(screen.getByLabelText(/tempo estimado/i), '90')
    await user.click(screen.getByRole('button', { name: /adicionar tarefa/i }))

    expect(await screen.findByText('Escrever testes')).toBeInTheDocument()
    expect(await screen.findByText('👤 Ana Souza')).toBeInTheDocument()
    expect(screen.getByText('⏱️ 90 min')).toBeInTheDocument()
  })

  it('sugere todas as pessoas cadastradas (não só os membros do projeto) como opções pro campo de responsável', async () => {
    server.use(http.get('/projetos/1', () => HttpResponse.json(PROJETO_DETALHE)))
    const user = userEvent.setup()
    renderPagina()

    await screen.findByText('Corrigir bug')
    await user.click(screen.getByLabelText(/nome do responsável/i))

    const opcoes = await screen.findAllByRole('option')
    expect(opcoes.map((opcao) => opcao.textContent)).toEqual(['Ana Souza', 'Beto Lima'])
  })

  it('nome de responsável que não bate com nenhuma pessoa cadastrada mostra "Pessoa não encontrada" e cria a tarefa sem atribuir ninguém', async () => {
    let colunas: ColunaComCards[] = PROJETO_DETALHE.colunas
    server.use(
      http.get('/projetos/1', () => HttpResponse.json({ ...PROJETO_DETALHE, colunas })),
      http.post('/colunas/5/cards', async ({ request }) => {
        const corpo = (await request.json()) as { titulo: string; responsavelId: number | null }
        expect(corpo.responsavelId).toBeNull()
        const novoCard = {
          id: 9,
          colunaId: 5,
          titulo: corpo.titulo,
          descricao: null,
          posicao: 2048,
          responsavelId: null,
          prazo: null,
          estimativaMinutos: null,
          criadoPorId: 1,
          criadoEm: '2026-01-15T10:00:00Z',
          arquivado: false,
        }
        colunas = [{ ...colunas[0], cards: [...colunas[0].cards, novoCard] }]
        return HttpResponse.json(novoCard, { status: 201 })
      }),
    )
    const user = userEvent.setup()
    renderPagina()

    await screen.findByText('Corrigir bug')
    await user.type(screen.getByLabelText(/nova tarefa/i), 'Tarefa sem dono')
    await user.type(screen.getByLabelText(/nome do responsável/i), 'Alguém que não existe')

    expect(await screen.findByText(/pessoa não encontrada/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /adicionar tarefa/i }))

    expect(await screen.findByText('Tarefa sem dono')).toBeInTheDocument()
    expect(screen.queryByText(/👤/)).not.toBeInTheDocument()
  })

  it('mostra a ocupação vs. o limite de WIP quando a coluna tem limite', async () => {
    server.use(
      http.get('/projetos/1', () =>
        HttpResponse.json({
          ...PROJETO_DETALHE,
          colunas: [{ ...PROJETO_DETALHE.colunas[0], nome: 'Em progresso', limiteWip: 3 }],
        }),
      ),
    )

    renderPagina()

    expect(await screen.findByText('Em progresso')).toBeInTheDocument()
    expect(screen.getByText('1/3')).toBeInTheDocument()
  })

  it('coluna sem limite de WIP não mostra contador', async () => {
    server.use(http.get('/projetos/1', () => HttpResponse.json(PROJETO_DETALHE)))

    renderPagina()

    await screen.findByText('A fazer')
    expect(screen.queryByText(/^\d+\/\d+$/)).not.toBeInTheDocument()
  })

  it('projeto sem colunas mostra mensagem vazia', async () => {
    server.use(http.get('/projetos/1', () => HttpResponse.json({ ...PROJETO_DETALHE, colunas: [] })))

    renderPagina()

    expect(await screen.findByText(/nenhuma coluna/i)).toBeInTheDocument()
  })

  it('colaborador também cria uma nova seção (pedido do usuário: "um funcionário pode adicionar seções")', async () => {
    // Papel padrão do describe já é COLABORADOR (ver beforeEach) - diferente de `adicionarMembro`
    // (GESTOR/ADMIN só, inalterado), criar seção deixou de exigir papel nenhum.
    let colunas: ColunaComCards[] = PROJETO_DETALHE.colunas
    server.use(
      http.get('/projetos/1', () => HttpResponse.json({ ...PROJETO_DETALHE, colunas })),
      http.post('/projetos/1/colunas', async ({ request }) => {
        const corpo = (await request.json()) as { nome: string; ordem: number; limiteWip: number | null }
        const nova = { id: 99, nome: corpo.nome, ordem: corpo.ordem, limiteWip: null, cards: [] }
        colunas = [...colunas, nova]
        return HttpResponse.json({ id: 99, projetoId: 1, nome: corpo.nome, ordem: corpo.ordem, limiteWip: null }, { status: 201 })
      }),
    )
    const user = userEvent.setup()
    renderPagina()

    await screen.findByText('A fazer')
    await user.click(screen.getByRole('button', { name: /nova seção/i }))
    await user.type(screen.getByLabelText(/nome da seção/i), 'Revisão')
    await user.click(screen.getByRole('button', { name: /^adicionar$/i }))

    expect(await screen.findByText('Revisão')).toBeInTheDocument()
  })

  it('gestor cria uma nova seção (coluna) e ela aparece no board sem reload manual', async () => {
    useAuthStore.getState().definirSessao('token-fake', 'GESTOR')
    let colunas: ColunaComCards[] = PROJETO_DETALHE.colunas
    server.use(
      http.get('/projetos/1', () => HttpResponse.json({ ...PROJETO_DETALHE, colunas })),
      http.post('/projetos/1/colunas', async ({ request }) => {
        const corpo = (await request.json()) as { nome: string; ordem: number; limiteWip: number | null }
        // única coluna existente é "A fazer" com ordem 0 - a próxima deve ser 1.
        expect(corpo.ordem).toBe(1)
        expect(corpo.limiteWip).toBeNull()
        const nova = { id: 99, nome: corpo.nome, ordem: corpo.ordem, limiteWip: null, cards: [] }
        colunas = [...colunas, nova]
        return HttpResponse.json({ id: 99, projetoId: 1, nome: corpo.nome, ordem: corpo.ordem, limiteWip: null }, { status: 201 })
      }),
    )
    const user = userEvent.setup()
    renderPagina()

    await screen.findByText('A fazer')
    await user.click(screen.getByRole('button', { name: /nova seção/i }))
    await user.type(screen.getByLabelText(/nome da seção/i), 'Revisão')
    await user.click(screen.getByRole('button', { name: /^adicionar$/i }))

    expect(await screen.findByText('Revisão')).toBeInTheDocument()
  })

  it('cancelar a criação de seção fecha o formulário sem enviar nada', async () => {
    useAuthStore.getState().definirSessao('token-fake', 'GESTOR')
    server.use(http.get('/projetos/1', () => HttpResponse.json(PROJETO_DETALHE)))
    const user = userEvent.setup()
    renderPagina()

    await screen.findByText('A fazer')
    await user.click(screen.getByRole('button', { name: /nova seção/i }))
    await user.type(screen.getByLabelText(/nome da seção/i), 'Não devia ir')
    await user.click(screen.getByRole('button', { name: /cancelar/i }))

    expect(screen.queryByLabelText(/nome da seção/i)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /nova seção/i })).toBeInTheDocument()
  })

  it('não busca comentários/histórico/cronômetro antes do card ser expandido (um único toggle "Detalhes")', async () => {
    server.use(http.get('/projetos/1', () => HttpResponse.json(PROJETO_DETALHE)))

    renderPagina()

    await screen.findByText('Corrigir bug')
    expect(screen.queryByText('Já revisei')).not.toBeInTheDocument()
    expect(screen.queryByText(/card criado em/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /iniciar/i })).not.toBeInTheDocument()
  })

  it('cardIdParaAbrir já abre "Detalhes" daquele card, sem precisar clicar (widget do cronômetro ativo)', async () => {
    server.use(http.get('/projetos/1', () => HttpResponse.json(PROJETO_DETALHE)))

    renderPagina(7)

    await screen.findByText('Corrigir bug')
    expect(await screen.findByRole('button', { name: /ocultar detalhes/i })).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: /cronômetro/i })).toBeInTheDocument()
  })

  it('um clique em "Detalhes" mostra cronômetro, comentários E histórico juntos (pedido: "facilite o front")', async () => {
    server.use(http.get('/projetos/1', () => HttpResponse.json(PROJETO_DETALHE)))
    const user = userEvent.setup()
    renderPagina()

    await screen.findByText('Corrigir bug')
    await user.click(screen.getByRole('button', { name: /detalhes/i }))

    expect(await screen.findByRole('heading', { name: /cronômetro/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /comentários/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /histórico/i })).toBeInTheDocument()
  })

  it('expande o card e mostra os comentários existentes', async () => {
    server.use(
      http.get('/projetos/1', () => HttpResponse.json(PROJETO_DETALHE)),
      http.get('/cards/7/comentarios', () =>
        HttpResponse.json([{ id: 1, cardId: 7, autorId: 1, texto: 'Já revisei', criadoEm: '2026-01-15T10:00:00Z' }]),
      ),
    )
    const user = userEvent.setup()
    renderPagina()

    await screen.findByText('Corrigir bug')
    await user.click(screen.getByRole('button', { name: /detalhes/i }))

    expect(await screen.findByText('Já revisei')).toBeInTheDocument()
  })

  it('adiciona um comentário novo e ele aparece na lista sem reload manual', async () => {
    let comentarios: Array<{ id: number; cardId: number; autorId: number; texto: string; criadoEm: string }> = []
    server.use(
      http.get('/projetos/1', () => HttpResponse.json(PROJETO_DETALHE)),
      http.get('/cards/7/comentarios', () => HttpResponse.json(comentarios)),
      http.post('/cards/7/comentarios', async ({ request }) => {
        const corpo = (await request.json()) as { texto: string }
        const novo = { id: 1, cardId: 7, autorId: 1, texto: corpo.texto, criadoEm: '2026-01-15T10:00:00Z' }
        comentarios = [...comentarios, novo]
        return HttpResponse.json(novo, { status: 201 })
      }),
    )
    const user = userEvent.setup()
    renderPagina()

    await screen.findByText('Corrigir bug')
    await user.click(screen.getByRole('button', { name: /detalhes/i }))
    await screen.findByLabelText(/novo comentário/i)
    await user.type(screen.getByLabelText(/novo comentário/i), 'Ficou ótimo')
    await user.click(screen.getByRole('button', { name: /^comentar$/i }))

    expect(await screen.findByText('Ficou ótimo')).toBeInTheDocument()
  })

  it('mostra erro quando o usuário não tem acesso ao projeto do card', async () => {
    server.use(
      http.get('/projetos/1', () => HttpResponse.json(PROJETO_DETALHE)),
      http.get('/cards/7/comentarios', () => new HttpResponse(null, { status: 403 })),
    )
    const user = userEvent.setup()
    renderPagina()

    await screen.findByText('Corrigir bug')
    await user.click(screen.getByRole('button', { name: /detalhes/i }))

    expect(await screen.findByText(/não foi possível carregar os comentários/i)).toBeInTheDocument()
  })

  it('expande o histórico e mostra os eventos do cronômetro, em ordem cronológica, com dia/hora', async () => {
    server.use(
      http.get('/projetos/1', () => HttpResponse.json(PROJETO_DETALHE)),
      http.get('/cards/7/eventos', () =>
        HttpResponse.json([
          { id: 1, cardId: 7, autorId: 1, tipo: 'CRIACAO', de: null, para: 'A fazer', criadoEm: '2026-01-15T09:00:00Z' },
          { id: 2, cardId: 7, autorId: 1, tipo: 'INICIOU_TRABALHO', de: null, para: null, criadoEm: '2026-01-15T10:00:00Z' },
          { id: 3, cardId: 7, autorId: 1, tipo: 'PAUSOU_TRABALHO', de: null, para: '45 min', criadoEm: '2026-01-15T10:45:00Z' },
          {
            id: 4,
            cardId: 7,
            autorId: 1,
            tipo: 'FINALIZOU_TRABALHO',
            de: '45 min',
            para: 'Corrigido e testado',
            criadoEm: '2026-01-15T11:00:00Z',
          },
        ]),
      ),
    )
    const user = userEvent.setup()
    renderPagina()

    await screen.findByText('Corrigir bug')
    await user.click(screen.getByRole('button', { name: /detalhes/i }))

    const lista = await screen.findByRole('list', { name: /histórico do card/i })
    const itens = within(lista).getAllByRole('listitem')
    expect(itens.map((item) => item.textContent)).toEqual([
      expect.stringContaining('Card criado em "A fazer"'),
      expect.stringContaining('Cronômetro iniciado'),
      expect.stringContaining('Cronômetro pausado (45 min)'),
      expect.stringContaining('Tarefa finalizada (45 min) — "Corrigido e testado"'),
    ])
    // dia/hora precisa estar visível, não só o rótulo do evento.
    expect(itens[0].textContent).toMatch(/\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}/)
  })

  it('mostra erro quando o histórico não pode ser carregado', async () => {
    server.use(
      http.get('/projetos/1', () => HttpResponse.json(PROJETO_DETALHE)),
      http.get('/cards/7/eventos', () => new HttpResponse(null, { status: 403 })),
    )
    const user = userEvent.setup()
    renderPagina()

    await screen.findByText('Corrigir bug')
    await user.click(screen.getByRole('button', { name: /detalhes/i }))

    expect(await screen.findByText(/não foi possível carregar o histórico/i)).toBeInTheDocument()
  })

  it('tarefa nunca trabalhada mostra só o botão Iniciar, sem relógio', async () => {
    server.use(http.get('/projetos/1', () => HttpResponse.json(PROJETO_DETALHE)))
    const user = userEvent.setup()
    renderPagina()

    await screen.findByText('Corrigir bug')
    await user.click(screen.getByRole('button', { name: /detalhes/i }))

    expect(await screen.findByRole('button', { name: /▶️ iniciar/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /pausar/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('timer')).not.toBeInTheDocument()
  })

  it('inicia o cronômetro e passa a mostrar o relógio rodando e o botão Pausar', async () => {
    // Handler de GET é stateful (mesmo padrão de `membros`/`colunas` nos testes acima) - a mutação
    // não escreve direto no cache, é o refetch disparado por `invalidateQueries` que precisa
    // devolver o estado novo pra UI atualizar.
    let cronometro: Cronometro = CRONOMETRO_NUNCA_INICIADO
    server.use(
      http.get('/projetos/1', () => HttpResponse.json(PROJETO_DETALHE)),
      http.get('/cards/7/cronometro', () => HttpResponse.json(cronometro)),
      http.post('/cards/7/cronometro/iniciar', () => {
        cronometro = { cardId: 7, iniciadoEm: '2026-01-15T09:00:00Z', totalMinutosFechados: 0, descricaoConclusao: null, concluidoEm: null }
        return HttpResponse.json(cronometro)
      }),
    )
    const user = userEvent.setup()
    renderPagina()

    await screen.findByText('Corrigir bug')
    await user.click(screen.getByRole('button', { name: /detalhes/i }))
    await user.click(await screen.findByRole('button', { name: /▶️ iniciar/i }))

    expect(await screen.findByRole('button', { name: /pausar/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /▶️ iniciar/i })).not.toBeInTheDocument()
    expect(screen.getByRole('timer')).toHaveTextContent(/\d{2}:\d{2}:\d{2}/)
  })

  it('pausa o cronômetro e mostra o total parado com o botão Retomar', async () => {
    let cronometro: Cronometro = { cardId: 7, iniciadoEm: '2026-01-15T09:00:00Z', totalMinutosFechados: 0, descricaoConclusao: null, concluidoEm: null }
    server.use(
      http.get('/projetos/1', () => HttpResponse.json(PROJETO_DETALHE)),
      http.get('/cards/7/cronometro', () => HttpResponse.json(cronometro)),
      http.post('/cards/7/cronometro/pausar', () => {
        cronometro = { cardId: 7, iniciadoEm: null, totalMinutosFechados: 45, descricaoConclusao: null, concluidoEm: null }
        return HttpResponse.json(cronometro)
      }),
    )
    const user = userEvent.setup()
    renderPagina()

    await screen.findByText('Corrigir bug')
    await user.click(screen.getByRole('button', { name: /detalhes/i }))
    await user.click(await screen.findByRole('button', { name: /pausar/i }))

    expect(await screen.findByRole('button', { name: /▶️ retomar/i })).toBeInTheDocument()
    expect(screen.getByRole('timer')).toHaveTextContent('00:45:00')
  })

  it('finaliza a tarefa pedindo uma descrição do que foi feito e mostra o resultado, sem mais botões', async () => {
    let cronometro: Cronometro = { cardId: 7, iniciadoEm: null, totalMinutosFechados: 45, descricaoConclusao: null, concluidoEm: null }
    server.use(
      http.get('/projetos/1', () => HttpResponse.json(PROJETO_DETALHE)),
      http.get('/cards/7/cronometro', () => HttpResponse.json(cronometro)),
      http.post('/cards/7/cronometro/finalizar', async ({ request }) => {
        const corpo = (await request.json()) as { descricao: string }
        cronometro = { cardId: 7, iniciadoEm: null, totalMinutosFechados: 45, descricaoConclusao: corpo.descricao, concluidoEm: '2026-01-15T12:00:00Z' }
        return HttpResponse.json(cronometro)
      }),
    )
    const user = userEvent.setup()
    renderPagina()

    await screen.findByText('Corrigir bug')
    await user.click(screen.getByRole('button', { name: /detalhes/i }))
    await user.click(await screen.findByRole('button', { name: /finalizar/i }))
    await user.type(screen.getByLabelText(/o que foi feito/i), 'Corrigido e testado em produção')
    await user.click(screen.getByRole('button', { name: /confirmar/i }))

    expect(await screen.findByText(/corrigido e testado em produção/i)).toBeInTheDocument()
    expect(screen.getByRole('timer')).toHaveTextContent('00:45:00')
    expect(screen.queryByRole('button', { name: /▶️ retomar/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /finalizar/i })).not.toBeInTheDocument()
  })
})
