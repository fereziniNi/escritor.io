import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { setupServer } from 'msw/node'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { useAuthStore } from '../auth/authStore'
import { QuadroDetalhePage } from './QuadroDetalhePage'

const server = setupServer()

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

const ESTADO_INICIAL = useAuthStore.getState()

beforeEach(() => {
  useAuthStore.setState(ESTADO_INICIAL, true)
  useAuthStore.getState().definirSessao('token-fake', 'COLABORADOR')
})

function renderPagina() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/kanban/1']}>
        <Routes>
          <Route path="/kanban/:id" element={<QuadroDetalhePage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const QUADRO_DETALHE = {
  id: 1,
  nome: 'Backlog',
  projetoId: null,
  equipeId: 10,
  arquivado: false,
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
          etiquetas: [],
        },
      ],
    },
  ],
}

function semEtiquetasDoQuadro() {
  return http.get('/quadros/1/etiquetas', () => HttpResponse.json([]))
}

describe('QuadroDetalhePage', () => {
  it('mostra o nome do quadro, as colunas e os cards', async () => {
    server.use(http.get('/quadros/1', () => HttpResponse.json(QUADRO_DETALHE)), semEtiquetasDoQuadro())

    renderPagina()

    expect(await screen.findByRole('heading', { name: 'Backlog' })).toBeInTheDocument()
    expect(screen.getByText('A fazer')).toBeInTheDocument()
    expect(screen.getByText('Corrigir bug')).toBeInTheDocument()
  })

  it('cria um card na coluna certa e ele aparece sem reload manual', async () => {
    let colunas = QUADRO_DETALHE.colunas
    server.use(
      http.get('/quadros/1', () => HttpResponse.json({ ...QUADRO_DETALHE, colunas })),
      semEtiquetasDoQuadro(),
      http.post('/colunas/5/cards', async ({ request }) => {
        const corpo = (await request.json()) as { titulo: string }
        const novoCard = {
          id: 8,
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
          etiquetas: [],
        }
        colunas = [{ ...colunas[0], cards: [...colunas[0].cards, novoCard] }]
        return HttpResponse.json(novoCard, { status: 201 })
      }),
    )
    const user = userEvent.setup()
    renderPagina()

    await screen.findByText('Corrigir bug')
    await user.type(screen.getByLabelText(/novo card/i), 'Escrever testes')
    await user.click(screen.getByRole('button', { name: /adicionar card/i }))

    expect(await screen.findByText('Escrever testes')).toBeInTheDocument()
  })

  it('mostra a ocupação vs. o limite de WIP quando a coluna tem limite', async () => {
    server.use(
      http.get('/quadros/1', () =>
        HttpResponse.json({
          ...QUADRO_DETALHE,
          colunas: [{ ...QUADRO_DETALHE.colunas[0], nome: 'Em progresso', limiteWip: 3 }],
        }),
      ),
      semEtiquetasDoQuadro(),
    )

    renderPagina()

    expect(await screen.findByText('Em progresso')).toBeInTheDocument()
    expect(screen.getByText('1/3')).toBeInTheDocument()
  })

  it('coluna sem limite de WIP não mostra contador', async () => {
    server.use(http.get('/quadros/1', () => HttpResponse.json(QUADRO_DETALHE)), semEtiquetasDoQuadro())

    renderPagina()

    await screen.findByText('A fazer')
    expect(screen.queryByText(/^\d+\/\d+$/)).not.toBeInTheDocument()
  })

  it('quadro sem colunas mostra mensagem vazia', async () => {
    server.use(
      http.get('/quadros/1', () => HttpResponse.json({ ...QUADRO_DETALHE, colunas: [] })),
      semEtiquetasDoQuadro(),
    )

    renderPagina()

    expect(await screen.findByText(/nenhuma coluna/i)).toBeInTheDocument()
  })

  it('mostra as etiquetas já aplicadas no card', async () => {
    server.use(
      http.get('/quadros/1', () =>
        HttpResponse.json({
          ...QUADRO_DETALHE,
          colunas: [
            {
              ...QUADRO_DETALHE.colunas[0],
              cards: [
                {
                  ...QUADRO_DETALHE.colunas[0].cards[0],
                  etiquetas: [{ id: 2, quadroId: 1, nome: 'Urgente', cor: '#FF0000' }],
                },
              ],
            },
          ],
        }),
      ),
      semEtiquetasDoQuadro(),
    )

    renderPagina()

    expect(await screen.findByText('Urgente')).toBeInTheDocument()
  })

  it('gestor cria uma etiqueta nova no quadro', async () => {
    useAuthStore.getState().definirSessao('token-fake', 'GESTOR')
    let etiquetas: Array<{ id: number; quadroId: number; nome: string; cor: string }> = []
    server.use(
      http.get('/quadros/1', () => HttpResponse.json(QUADRO_DETALHE)),
      http.get('/quadros/1/etiquetas', () => HttpResponse.json(etiquetas)),
      http.post('/quadros/1/etiquetas', async ({ request }) => {
        const corpo = (await request.json()) as { nome: string; cor: string }
        const nova = { id: 9, quadroId: 1, nome: corpo.nome, cor: corpo.cor }
        etiquetas = [...etiquetas, nova]
        return HttpResponse.json(nova, { status: 201 })
      }),
    )
    const user = userEvent.setup()
    renderPagina()

    await screen.findByText('Corrigir bug')
    await user.type(screen.getByLabelText(/nome da etiqueta/i), 'Bug')
    await user.type(screen.getByLabelText(/cor da etiqueta/i), '#00FF00')
    await user.click(screen.getByRole('button', { name: /criar etiqueta/i }))

    expect(await screen.findByText('Bug')).toBeInTheDocument()
  })

  it('colaborador não vê o formulário de criar etiqueta', async () => {
    server.use(http.get('/quadros/1', () => HttpResponse.json(QUADRO_DETALHE)), semEtiquetasDoQuadro())

    renderPagina()

    await screen.findByText('Corrigir bug')
    expect(screen.queryByLabelText(/nome da etiqueta/i)).not.toBeInTheDocument()
  })

  it('aplica uma etiqueta existente no card e ela aparece sem reload manual', async () => {
    let etiquetasDoCard: Array<{ id: number; quadroId: number; nome: string; cor: string }> = []
    server.use(
      http.get('/quadros/1', () =>
        HttpResponse.json({
          ...QUADRO_DETALHE,
          colunas: [{ ...QUADRO_DETALHE.colunas[0], cards: [{ ...QUADRO_DETALHE.colunas[0].cards[0], etiquetas: etiquetasDoCard }] }],
        }),
      ),
      http.get('/quadros/1/etiquetas', () => HttpResponse.json([{ id: 2, quadroId: 1, nome: 'Urgente', cor: '#FF0000' }])),
      http.post('/cards/7/etiquetas', async ({ request }) => {
        const corpo = (await request.json()) as { etiquetaId: number }
        expect(corpo.etiquetaId).toBe(2)
        etiquetasDoCard = [{ id: 2, quadroId: 1, nome: 'Urgente', cor: '#FF0000' }]
        return HttpResponse.json(etiquetasDoCard[0])
      }),
    )
    const user = userEvent.setup()
    renderPagina()

    await screen.findByText('Corrigir bug')
    await user.selectOptions(screen.getByLabelText(/aplicar etiqueta/i), '2')
    await user.click(screen.getByRole('button', { name: /^aplicar$/i }))

    expect(await screen.findByText('Urgente')).toBeInTheDocument()
  })

  it('remove uma etiqueta do card e ela some sem reload manual', async () => {
    let etiquetasDoCard = [{ id: 2, quadroId: 1, nome: 'Urgente', cor: '#FF0000' }]
    server.use(
      http.get('/quadros/1', () =>
        HttpResponse.json({
          ...QUADRO_DETALHE,
          colunas: [{ ...QUADRO_DETALHE.colunas[0], cards: [{ ...QUADRO_DETALHE.colunas[0].cards[0], etiquetas: etiquetasDoCard }] }],
        }),
      ),
      semEtiquetasDoQuadro(),
      http.delete('/cards/7/etiquetas/2', () => {
        etiquetasDoCard = []
        return new HttpResponse(null, { status: 204 })
      }),
    )
    const user = userEvent.setup()
    renderPagina()

    await screen.findByText('Urgente')
    await user.click(screen.getByRole('button', { name: /remover urgente/i }))

    await waitFor(() => expect(screen.queryByText('Urgente')).not.toBeInTheDocument())
  })

  it('não busca comentários antes do card ser expandido', async () => {
    server.use(http.get('/quadros/1', () => HttpResponse.json(QUADRO_DETALHE)), semEtiquetasDoQuadro())

    renderPagina()

    await screen.findByText('Corrigir bug')
    expect(screen.queryByText('Já revisei')).not.toBeInTheDocument()
  })

  it('expande o card e mostra os comentários existentes', async () => {
    server.use(
      http.get('/quadros/1', () => HttpResponse.json(QUADRO_DETALHE)),
      semEtiquetasDoQuadro(),
      http.get('/cards/7/comentarios', () =>
        HttpResponse.json([{ id: 1, cardId: 7, autorId: 1, texto: 'Já revisei', criadoEm: '2026-01-15T10:00:00Z' }]),
      ),
    )
    const user = userEvent.setup()
    renderPagina()

    await screen.findByText('Corrigir bug')
    await user.click(screen.getByRole('button', { name: /comentários/i }))

    expect(await screen.findByText('Já revisei')).toBeInTheDocument()
  })

  it('adiciona um comentário novo e ele aparece na lista sem reload manual', async () => {
    let comentarios: Array<{ id: number; cardId: number; autorId: number; texto: string; criadoEm: string }> = []
    server.use(
      http.get('/quadros/1', () => HttpResponse.json(QUADRO_DETALHE)),
      semEtiquetasDoQuadro(),
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
    await user.click(screen.getByRole('button', { name: /comentários/i }))
    await screen.findByLabelText(/novo comentário/i)
    await user.type(screen.getByLabelText(/novo comentário/i), 'Ficou ótimo')
    await user.click(screen.getByRole('button', { name: /^comentar$/i }))

    expect(await screen.findByText('Ficou ótimo')).toBeInTheDocument()
  })

  it('mostra erro quando o usuário não tem acesso ao quadro do card', async () => {
    server.use(
      http.get('/quadros/1', () => HttpResponse.json(QUADRO_DETALHE)),
      semEtiquetasDoQuadro(),
      http.get('/cards/7/comentarios', () => new HttpResponse(null, { status: 403 })),
    )
    const user = userEvent.setup()
    renderPagina()

    await screen.findByText('Corrigir bug')
    await user.click(screen.getByRole('button', { name: /comentários/i }))

    expect(await screen.findByText(/não foi possível carregar os comentários/i)).toBeInTheDocument()
  })

  it('não busca o histórico antes do card ser expandido', async () => {
    server.use(http.get('/quadros/1', () => HttpResponse.json(QUADRO_DETALHE)), semEtiquetasDoQuadro())

    renderPagina()

    await screen.findByText('Corrigir bug')
    expect(screen.queryByText(/card criado em/i)).not.toBeInTheDocument()
  })

  it('expande o histórico e mostra os eventos em ordem cronológica com rótulo legível', async () => {
    server.use(
      http.get('/quadros/1', () => HttpResponse.json(QUADRO_DETALHE)),
      semEtiquetasDoQuadro(),
      http.get('/cards/7/eventos', () =>
        HttpResponse.json([
          { id: 1, cardId: 7, autorId: 1, tipo: 'CRIACAO', de: null, para: 'A fazer', criadoEm: '2026-01-15T09:00:00Z' },
          {
            id: 2,
            cardId: 7,
            autorId: 1,
            tipo: 'MUDANCA_COLUNA',
            de: 'A fazer',
            para: 'Em progresso',
            criadoEm: '2026-01-15T10:00:00Z',
          },
        ]),
      ),
    )
    const user = userEvent.setup()
    renderPagina()

    await screen.findByText('Corrigir bug')
    await user.click(screen.getByRole('button', { name: /histórico/i }))

    const lista = await screen.findByRole('list', { name: /histórico do card/i })
    const itens = within(lista).getAllByRole('listitem')
    expect(itens.map((item) => item.textContent)).toEqual([
      expect.stringContaining('Card criado em "A fazer"'),
      expect.stringContaining('Movido de "A fazer" para "Em progresso"'),
    ])
  })

  it('mostra erro quando o histórico não pode ser carregado', async () => {
    server.use(
      http.get('/quadros/1', () => HttpResponse.json(QUADRO_DETALHE)),
      semEtiquetasDoQuadro(),
      http.get('/cards/7/eventos', () => new HttpResponse(null, { status: 403 })),
    )
    const user = userEvent.setup()
    renderPagina()

    await screen.findByText('Corrigir bug')
    await user.click(screen.getByRole('button', { name: /histórico/i }))

    expect(await screen.findByText(/não foi possível carregar o histórico/i)).toBeInTheDocument()
  })
})
