import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { useAuthStore } from '../auth/authStore'
import { periodoPadrao } from './estatisticasUtils'
import { RelatoriosPage } from './RelatoriosPage'
import type { Estatisticas } from './types'

// Pedido do cliente: filtrar relatório por pessoa é por nome, não por id - handler padrão
// restaurado a cada teste por `resetHandlers`.
const PESSOAS_CADASTRADAS = [
  { id: 1, nome: 'Ana Souza' },
  { id: 2, nome: 'Beto Lima' },
]

const server = setupServer(http.get('/usuarios/basico', () => HttpResponse.json(PESSOAS_CADASTRADAS)))

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

const ESTADO_INICIAL = useAuthStore.getState()

beforeEach(() => {
  useAuthStore.setState(ESTADO_INICIAL, true)
  useAuthStore.getState().definirSessao('token-fake', 'GESTOR')
})

const ESTATISTICAS_VAZIAS: Estatisticas = {
  pessoal: {
    totalMinutosTrabalhados: 0,
    diasTrabalhados: 0,
    mediaMinutosPorDiaTrabalhado: 0,
    reunioesParticipadas: 0,
    tarefasConcluidas: 0,
    tarefasConcluidasDetalhe: [],
    projetosConcluidos: 0,
    minutosPorHoraDoDia: new Array(24).fill(0),
  },
  equipe: {
    rankingHorasTrabalhadas: [{ usuarioId: 1, nome: 'Ana Souza', valor: 0 }],
    rankingTarefasConcluidas: [{ usuarioId: 1, nome: 'Ana Souza', valor: 0 }],
    rankingReunioes: [{ usuarioId: 1, nome: 'Ana Souza', valor: 0 }],
    reunioesPorHoraDoDia: new Array(24).fill(0),
  },
}

// `estatisticas`/`diasInconsistentes` são parâmetros (não fixos) pelo mesmo motivo do comentário
// acima: o primeiro handler cadastrado pra uma rota "ganha" no MSW, então um teste que precisa de
// uma resposta diferente não pode simplesmente empilhar `...handlersPadrao()` seguido de outro
// `http.get(...)` pra mesma rota - o handler padrão (vindo primeiro no array) venceria sempre.
function handlersPadrao(estatisticas: Estatisticas = ESTATISTICAS_VAZIAS, diasInconsistentes: string[] = []) {
  return [
    http.get('/projetos', () =>
      HttpResponse.json([
        { id: 10, nome: 'Projeto A', cliente: 'Acme', status: 'ATIVO', inicio: '2026-01-01', fimPrevisto: null },
        { id: 11, nome: 'Projeto B', cliente: 'Acme', status: 'ATIVO', inicio: '2026-01-01', fimPrevisto: null },
      ]),
    ),
    http.get('/ponto/espelho-do-mes', () => HttpResponse.json({ dias: [], saldoAcumuladoNoPeriodo: 60 })),
    http.get('/ponto/dias-inconsistentes', () => HttpResponse.json(diasInconsistentes)),
    http.get('/relatorios/estatisticas', () => HttpResponse.json(estatisticas)),
  ]
}

function renderPagina() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <RelatoriosPage />
    </QueryClientProvider>,
  )
}

describe('RelatoriosPage', () => {
  it('mostra o saldo acumulado do usuário', async () => {
    server.use(...handlersPadrao())

    renderPagina()

    expect(await screen.findByText('Saldo acumulado: +1h')).toBeInTheDocument()
  })

  it('pedido do usuário: "quero trazer as informações que eu pedi, sem usar o filtro" - dashboard aparece sozinho, sem preencher nada', async () => {
    server.use(
      ...handlersPadrao({
        ...ESTATISTICAS_VAZIAS,
        pessoal: { ...ESTATISTICAS_VAZIAS.pessoal, totalMinutosTrabalhados: 232, diasTrabalhados: 3 },
      }),
    )

    renderPagina()

    // nenhum `user.type`/`user.click` no formulário - só renderizar já basta.
    expect(await screen.findByText('3h52min')).toBeInTheDocument()
    expect(screen.getByText('Visão geral', { exact: false })).toBeInTheDocument()
    // os campos de data já vêm preenchidos (mês corrente até hoje) - não ficam vazios esperando
    // a pessoa digitar.
    expect(screen.getByLabelText(/início/i)).toHaveValue(periodoPadrao(new Date()).inicio)
    expect(screen.getByLabelText(/^fim$/i)).toHaveValue(periodoPadrao(new Date()).fim)
  })

  it('mostra os dias inconsistentes do período informado', async () => {
    server.use(...handlersPadrao(ESTATISTICAS_VAZIAS, ['2026-01-11', '2026-01-12']))
    const user = userEvent.setup()
    renderPagina()

    await screen.findByText('Saldo acumulado: +1h')
    // `.clear()` primeiro: os campos já vêm preenchidos com o período padrão (pedido do usuário:
    // "sem usar o filtro" - mês corrente até hoje, ver `periodoPadrao`) - digitar em cima de um
    // `<input type="date">` já preenchido não substitui o valor de forma confiável (jsdom).
    await user.clear(screen.getByLabelText(/início/i))
    await user.type(screen.getByLabelText(/início/i), '2026-01-01')
    await user.clear(screen.getByLabelText(/^fim$/i))
    await user.type(screen.getByLabelText(/^fim$/i), '2026-02-01')

    // exibido em dd/mm/aaaa, não a data ISO crua que a API devolve (pedido do usuário)
    expect(await screen.findByText('11/01/2026')).toBeInTheDocument()
    expect(screen.getByText('12/01/2026')).toBeInTheDocument()
  })

  it('trocar o projeto selecionado atualiza o total apontado sem reload manual', async () => {
    server.use(
      ...handlersPadrao(),
      http.get('/apontamentos/relatorio', ({ request }) => {
        const url = new URL(request.url)
        const projetoId = url.searchParams.get('projetoId')
        return HttpResponse.json({ totalMinutos: projetoId === '10' ? 90 : 45 })
      }),
    )
    const user = userEvent.setup()
    renderPagina()

    await screen.findByText('Saldo acumulado: +1h')
    // `.clear()` primeiro: os campos já vêm preenchidos com o período padrão (pedido do usuário:
    // "sem usar o filtro" - mês corrente até hoje, ver `periodoPadrao`) - digitar em cima de um
    // `<input type="date">` já preenchido não substitui o valor de forma confiável (jsdom).
    await user.clear(screen.getByLabelText(/início/i))
    await user.type(screen.getByLabelText(/início/i), '2026-01-01')
    await user.clear(screen.getByLabelText(/^fim$/i))
    await user.type(screen.getByLabelText(/^fim$/i), '2026-02-01')
    await user.selectOptions(screen.getByLabelText(/projeto/i), '10')

    expect(await screen.findByText('Total apontado: 1h30min')).toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText(/projeto/i), '11')

    expect(await screen.findByText('Total apontado: 45 min')).toBeInTheDocument()
  })

  it('digita o nome de uma pessoa cadastrada e filtra o saldo por ela', async () => {
    // Não usa `handlersPadrao()` aqui: ela já registra um handler estático pra
    // `/ponto/espelho-do-mes`, e o primeiro handler cadastrado pra uma rota "ganha" no MSW - o
    // handler abaixo (que lê `usuarioId` da query) nunca seria chamado se viesse depois dele.
    server.use(
      http.get('/projetos', () => HttpResponse.json([])),
      http.get('/ponto/espelho-do-mes', ({ request }) => {
        const url = new URL(request.url)
        const usuarioId = url.searchParams.get('usuarioId')
        return HttpResponse.json({ dias: [], saldoAcumuladoNoPeriodo: usuarioId === '2' ? 120 : 60 })
      }),
      // início/fim já vêm preenchidos por padrão (sem usar o filtro) - as consultas de período
      // disparam sozinhas assim que a página monta, então precisam de handler mesmo sem o teste
      // mexer nas datas.
      http.get('/ponto/dias-inconsistentes', () => HttpResponse.json([])),
      http.get('/relatorios/estatisticas', () => HttpResponse.json(ESTATISTICAS_VAZIAS)),
    )
    const user = userEvent.setup()
    renderPagina()

    await screen.findByText('Saldo acumulado: +1h')
    // pedido do usuário: digita o nome, não o id - "Beto Lima" está entre as pessoas cadastradas.
    await user.type(screen.getByLabelText(/usuário/i), 'Beto Lima')

    expect(await screen.findByText('Saldo acumulado: +2h')).toBeInTheDocument()
  })

  it('nome que não bate com nenhuma pessoa cadastrada mostra "Pessoa não encontrada" e não dispara a consulta', async () => {
    server.use(...handlersPadrao())
    const user = userEvent.setup()
    renderPagina()

    await screen.findByText('Saldo acumulado: +1h')
    await user.type(screen.getByLabelText(/usuário/i), 'Alguém que não existe')

    expect(await screen.findByText(/pessoa não encontrada/i)).toBeInTheDocument()
    // sem usuário resolvido, o saldo anterior (do "eu mesmo" inicial) some da tela.
    expect(screen.queryByText(/saldo acumulado/i)).not.toBeInTheDocument()
  })

  it('pedido do usuário: "total de horas trabalhadas, quantidade de atividades feitas... quantos projetos concluiu" - cartões de visão geral', async () => {
    server.use(
      ...handlersPadrao({
        ...ESTATISTICAS_VAZIAS,
        pessoal: {
          ...ESTATISTICAS_VAZIAS.pessoal,
          totalMinutosTrabalhados: 960,
          diasTrabalhados: 2,
          mediaMinutosPorDiaTrabalhado: 480,
          reunioesParticipadas: 3,
          tarefasConcluidas: 1,
          projetosConcluidos: 4,
        },
      }),
    )
    const user = userEvent.setup()
    renderPagina()

    await screen.findByText('Saldo acumulado: +1h')
    // `.clear()` primeiro: os campos já vêm preenchidos com o período padrão (pedido do usuário:
    // "sem usar o filtro" - mês corrente até hoje, ver `periodoPadrao`) - digitar em cima de um
    // `<input type="date">` já preenchido não substitui o valor de forma confiável (jsdom).
    await user.clear(screen.getByLabelText(/início/i))
    await user.type(screen.getByLabelText(/início/i), '2026-01-01')
    await user.clear(screen.getByLabelText(/^fim$/i))
    await user.type(screen.getByLabelText(/^fim$/i), '2026-02-01')

    expect(await screen.findByText('16h')).toBeInTheDocument() // horas trabalhadas
    expect(screen.getByText('2')).toBeInTheDocument() // dias trabalhados
    expect(screen.getByText('3')).toBeInTheDocument() // reuniões participadas
    expect(screen.getByText('4')).toBeInTheDocument() // projetos concluídos
  })

  it('pedido do usuário: "o que fez" - lista as tarefas concluídas no período', async () => {
    server.use(
      ...handlersPadrao({
        ...ESTATISTICAS_VAZIAS,
        pessoal: {
          ...ESTATISTICAS_VAZIAS.pessoal,
          tarefasConcluidas: 1,
          tarefasConcluidasDetalhe: [
            {
              cardId: 10,
              titulo: 'Publicar site',
              nomeProjeto: 'Site novo',
              concluidoEm: '2026-01-15T10:00:00Z',
              descricaoConclusao: 'Site publicado em produção',
            },
          ],
        },
      }),
    )
    const user = userEvent.setup()
    renderPagina()

    await screen.findByText('Saldo acumulado: +1h')
    // `.clear()` primeiro: os campos já vêm preenchidos com o período padrão (pedido do usuário:
    // "sem usar o filtro" - mês corrente até hoje, ver `periodoPadrao`) - digitar em cima de um
    // `<input type="date">` já preenchido não substitui o valor de forma confiável (jsdom).
    await user.clear(screen.getByLabelText(/início/i))
    await user.type(screen.getByLabelText(/início/i), '2026-01-01')
    await user.clear(screen.getByLabelText(/^fim$/i))
    await user.type(screen.getByLabelText(/^fim$/i), '2026-02-01')

    expect(await screen.findByText('Publicar site')).toBeInTheDocument()
    expect(screen.getByText('Site novo')).toBeInTheDocument()
    expect(screen.getByText('Site publicado em produção')).toBeInTheDocument()
  })

  it('pedido do usuário: "horário que mais trabalhou" - mostra o pico do histograma como texto', async () => {
    const minutosPorHoraDoDia = new Array(24).fill(0)
    minutosPorHoraDoDia[14] = 90
    server.use(...handlersPadrao({ ...ESTATISTICAS_VAZIAS, pessoal: { ...ESTATISTICAS_VAZIAS.pessoal, minutosPorHoraDoDia } }))
    const user = userEvent.setup()
    renderPagina()

    await screen.findByText('Saldo acumulado: +1h')
    // `.clear()` primeiro: os campos já vêm preenchidos com o período padrão (pedido do usuário:
    // "sem usar o filtro" - mês corrente até hoje, ver `periodoPadrao`) - digitar em cima de um
    // `<input type="date">` já preenchido não substitui o valor de forma confiável (jsdom).
    await user.clear(screen.getByLabelText(/início/i))
    await user.type(screen.getByLabelText(/início/i), '2026-01-01')
    await user.clear(screen.getByLabelText(/^fim$/i))
    await user.type(screen.getByLabelText(/^fim$/i), '2026-02-01')

    expect(await screen.findByText('14h-15h')).toBeInTheDocument()
  })

  it('equipe com só uma pessoa visível (colaborador) mostra a nota em vez de ranking', async () => {
    server.use(...handlersPadrao())
    const user = userEvent.setup()
    renderPagina()

    await screen.findByText('Saldo acumulado: +1h')
    // `.clear()` primeiro: os campos já vêm preenchidos com o período padrão (pedido do usuário:
    // "sem usar o filtro" - mês corrente até hoje, ver `periodoPadrao`) - digitar em cima de um
    // `<input type="date">` já preenchido não substitui o valor de forma confiável (jsdom).
    await user.clear(screen.getByLabelText(/início/i))
    await user.type(screen.getByLabelText(/início/i), '2026-01-01')
    await user.clear(screen.getByLabelText(/^fim$/i))
    await user.type(screen.getByLabelText(/^fim$/i), '2026-02-01')

    expect(await screen.findByText('Sem outras pessoas visíveis pra comparar.')).toBeInTheDocument()
  })

  it('pedido do usuário: "pessoa que fez mais reuniões" - ranking de equipe com mais de uma pessoa', async () => {
    server.use(
      ...handlersPadrao({
        ...ESTATISTICAS_VAZIAS,
        equipe: {
          ...ESTATISTICAS_VAZIAS.equipe,
          // as três listas sempre têm o mesmo conjunto de pessoas visíveis (só a ordem/valor
          // muda) - overrideando só uma ficaria inconsistente com o "mais de uma pessoa
          // visível" que o componente deriva de qualquer uma delas.
          rankingHorasTrabalhadas: [
            { usuarioId: 1, nome: 'Ana Souza', valor: 480 },
            { usuarioId: 2, nome: 'Beto Lima', valor: 300 },
          ],
          rankingTarefasConcluidas: [
            { usuarioId: 1, nome: 'Ana Souza', valor: 2 },
            { usuarioId: 2, nome: 'Beto Lima', valor: 1 },
          ],
          rankingReunioes: [
            { usuarioId: 2, nome: 'Beto Lima', valor: 5 },
            { usuarioId: 1, nome: 'Ana Souza', valor: 2 },
          ],
        },
      }),
    )
    const user = userEvent.setup()
    renderPagina()

    await screen.findByText('Saldo acumulado: +1h')
    // `.clear()` primeiro: os campos já vêm preenchidos com o período padrão (pedido do usuário:
    // "sem usar o filtro" - mês corrente até hoje, ver `periodoPadrao`) - digitar em cima de um
    // `<input type="date">` já preenchido não substitui o valor de forma confiável (jsdom).
    await user.clear(screen.getByLabelText(/início/i))
    await user.type(screen.getByLabelText(/início/i), '2026-01-01')
    await user.clear(screen.getByLabelText(/^fim$/i))
    await user.type(screen.getByLabelText(/^fim$/i), '2026-02-01')

    expect(await screen.findByText('🏅 Beto Lima')).toBeInTheDocument()
  })
})
