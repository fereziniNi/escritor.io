import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuthStore } from '../auth/authStore'
import { EspelhoMesPainel } from './EspelhoMesPainel'

const server = setupServer()

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

const ESTADO_INICIAL = useAuthStore.getState()

beforeEach(() => {
  useAuthStore.setState(ESTADO_INICIAL, true)
  useAuthStore.getState().definirSessao('token-fake', 'COLABORADOR')
})

function renderPainel() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <EspelhoMesPainel />
    </QueryClientProvider>,
  )
}

function estatisticasComTarefas(datas: string[]) {
  return {
    pessoal: {
      totalMinutosTrabalhados: 0,
      diasTrabalhados: 0,
      mediaMinutosPorDiaTrabalhado: 0,
      reunioesParticipadas: 0,
      tarefasConcluidas: datas.length,
      tarefasConcluidasDetalhe: datas.map((concluidoEm, indice) => ({
        cardId: indice + 1,
        titulo: `Tarefa ${indice + 1}`,
        nomeProjeto: 'Projeto',
        concluidoEm,
        descricaoConclusao: null,
      })),
      projetosConcluidos: 0,
      minutosPorHoraDoDia: new Array(24).fill(0),
    },
    equipe: { rankingHorasTrabalhadas: [], rankingTarefasConcluidas: [], rankingReunioes: [], reunioesPorHoraDoDia: new Array(24).fill(0) },
  }
}

function handlersAuxiliares(datasDeTarefas: string[] = [], meses: string[] = ['2026-01']) {
  return [
    http.get('/ponto/meses-disponiveis', () => HttpResponse.json(meses)),
    http.get('/relatorios/estatisticas', () => HttpResponse.json(estatisticasComTarefas(datasDeTarefas))),
  ]
}

describe('EspelhoMesPainel', () => {
  it('lista os dias do mês com saldo e o total acumulado', async () => {
    server.use(
      ...handlersAuxiliares(),
      http.get('/ponto/espelho-do-mes', () =>
        HttpResponse.json({
          dias: [
            { data: '2026-01-12', estado: 'FECHADA', minutosTrabalhados: 540, saldoDia: 60 },
            { data: '2026-01-13', estado: 'FECHADA', minutosTrabalhados: 480, saldoDia: 0 },
          ],
          saldoAcumuladoNoPeriodo: 60,
        }),
      ),
    )

    renderPainel()

    // exibido em dd/mm/aaaa, não a data ISO crua que a API devolve (pedido do usuário)
    expect(await screen.findByText('12/01/2026', { selector: 'td' })).toBeInTheDocument()
    expect(screen.getByText('13/01/2026', { selector: 'td' })).toBeInTheDocument()
    expect(screen.getByText('Saldo acumulado no período: +1h')).toBeInTheDocument()
  })

  it('mês sem nenhum dia mostra mensagem vazia', async () => {
    server.use(
      ...handlersAuxiliares(),
      http.get('/ponto/espelho-do-mes', () => HttpResponse.json({ dias: [], saldoAcumuladoNoPeriodo: 0 })),
    )

    renderPainel()

    expect(await screen.findByText(/nenhuma marcação neste mês/i)).toBeInTheDocument()
  })

  it('clica em exportar CSV e dispara o download do arquivo retornado pela API', async () => {
    server.use(
      ...handlersAuxiliares(),
      http.get('/ponto/espelho-do-mes', ({ request }) => {
        const url = new URL(request.url)
        if (url.searchParams.get('formato') === 'csv') {
          return new HttpResponse('Data,Estado,Minutos Trabalhados,Saldo\n2026-01-12,FECHADA,540,60\n', {
            headers: { 'Content-Type': 'text/csv' },
          })
        }
        return HttpResponse.json({ dias: [], saldoAcumuladoNoPeriodo: 60 })
      }),
    )
    const cliqueSimulado = vi.fn()
    const criarObjectUrl = vi.fn(() => 'blob:fake-url')
    const revogarObjectUrl = vi.fn()
    vi.spyOn(URL, 'createObjectURL').mockImplementation(criarObjectUrl)
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(revogarObjectUrl)
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(cliqueSimulado)
    const user = userEvent.setup()
    renderPainel()

    await screen.findByText(/nenhuma marcação neste mês/i)
    await user.click(screen.getByRole('button', { name: /exportar csv/i }))

    await vi.waitFor(() => expect(criarObjectUrl).toHaveBeenCalledTimes(1))
    expect(cliqueSimulado).toHaveBeenCalledTimes(1)
    expect(revogarObjectUrl).toHaveBeenCalledWith('blob:fake-url')
  })

  it('troca de mês pelo seletor e busca o espelho e as tarefas do mês escolhido', async () => {
    const periodosPedidos: string[] = []
    server.use(
      ...handlersAuxiliares([], ['2026-01', '2025-12']).slice(0, 1),
      http.get('/relatorios/estatisticas', ({ request }) => {
        periodosPedidos.push(new URL(request.url).searchParams.get('inicio') ?? '')
        return HttpResponse.json(estatisticasComTarefas([]))
      }),
      http.get('/ponto/espelho-do-mes', ({ request }) => {
        const mes = new URL(request.url).searchParams.get('mes')
        return HttpResponse.json({
          dias: mes === '2025-12' ? [{ data: '2025-12-10', estado: 'FECHADA', minutosTrabalhados: 360, saldoDia: -120 }] : [],
          saldoAcumuladoNoPeriodo: 0,
        })
      }),
    )
    const user = userEvent.setup()
    renderPainel()

    await screen.findByText(/nenhuma marcação neste mês/i)
    await user.selectOptions(screen.getByLabelText('Mês'), '2025-12')

    expect(await screen.findByText('10/12/2025', { selector: 'td' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Dezembro/2025' })).toBeInTheDocument()
    expect(periodosPedidos).toEqual([`${new Date().toISOString().slice(0, 7)}-01T00:00:00Z`, '2025-12-01T00:00:00Z'])
  })

  it('mostra os insights do mês: dia e semana que mais trabalhou, tarefas e gráfico por dia', async () => {
    server.use(
      ...handlersAuxiliares(['2026-01-12T14:00:00Z', '2026-01-12T16:00:00Z', '2026-01-13T10:00:00Z']),
      http.get('/ponto/espelho-do-mes', () =>
        HttpResponse.json({
          dias: [
            { data: '2026-01-12', estado: 'FECHADA', minutosTrabalhados: 540, saldoDia: 60 },
            { data: '2026-01-13', estado: 'FECHADA', minutosTrabalhados: 300, saldoDia: -180 },
          ],
          saldoAcumuladoNoPeriodo: -120,
        }),
      ),
    )

    renderPainel()

    expect(await screen.findByText('Dia que mais trabalhou')).toBeInTheDocument()
    expect(screen.getByText('Total trabalhado').nextElementSibling).toHaveTextContent('14h')
    expect(screen.getByText('Semana que mais trabalhou').nextElementSibling).toHaveTextContent('12/01 a 18/01')
    expect(screen.getByText('Dia da semana mais produtivo').nextElementSibling).toHaveTextContent('segunda-feira')
    expect(await screen.findByText('mais em 12/01/2026 (2)')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /horas trabalhadas por dia do mês/i })).toBeInTheDocument()
  })

  it('mês sem nenhum dado não mostra o bloco de insights', async () => {
    server.use(
      ...handlersAuxiliares(),
      http.get('/ponto/espelho-do-mes', () => HttpResponse.json({ dias: [], saldoAcumuladoNoPeriodo: 0 })),
    )

    renderPainel()

    await screen.findByText(/nenhuma marcação neste mês/i)
    expect(screen.queryByText(/insights do mês/i)).not.toBeInTheDocument()
  })
})
