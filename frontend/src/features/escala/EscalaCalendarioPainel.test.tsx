import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { formatarDataBr } from '../../shared/formatarData'
import { anoDaData, dataDeHoje, mesDaData, nomeDoDiaDaSemana } from './datasEscala'
import { EscalaCalendarioPainel } from './EscalaCalendarioPainel'

const server = setupServer()

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

const HOJE = dataDeHoje()
const NOMES_MESES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
]
const ROTULO_MES_ATUAL = `${NOMES_MESES[mesDaData(HOJE) - 1]} de ${anoDaData(HOJE)}`

function renderPainel() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <EscalaCalendarioPainel />
    </QueryClientProvider>,
  )
}

describe('EscalaCalendarioPainel', () => {
  it('clicar num dia do mês abre a agenda completa daquele dia (visão de Dia), não direto o formulário', async () => {
    // pedido do usuário: "caso a pessoa clica no dia deve abrir a agenda dela do dia e ver todos
    // os horarios dela disponivel, incluindo o que ela deixou salvo no padrão semanal" - clicar
    // no mês troca de visão em vez de abrir o modal de exceção direto.
    server.use(
      http.get('/escala/efetiva', () => HttpResponse.json([])),
      http.get('/escala/excecoes', () => HttpResponse.json([])),
    )
    const user = userEvent.setup()
    renderPainel()

    expect(await screen.findByText(ROTULO_MES_ATUAL)).toBeInTheDocument()
    await user.click(await screen.findByRole('button', { name: formatarDataBr(HOJE) }))

    expect(await screen.findByText(`${nomeDoDiaDaSemana(HOJE)}, ${formatarDataBr(HOJE)}`)).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Dia', selected: true })).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('a agenda do dia (depois de clicar num dia do mês) já mostra o horário do padrão semanal', async () => {
    server.use(
      http.get('/escala/efetiva', () =>
        HttpResponse.json([{ data: HOJE, trabalha: true, horaInicio: '09:00:00', horaFim: '18:00:00' }]),
      ),
      http.get('/escala/excecoes', () => HttpResponse.json([])),
    )
    const user = userEvent.setup()
    renderPainel()

    await screen.findByText(ROTULO_MES_ATUAL)
    await user.click(await screen.findByRole('button', { name: formatarDataBr(HOJE) }))

    expect(await screen.findByText('09:00–18:00')).toBeInTheDocument()
  })

  it('troca pra visão de semana e mostra o período da semana atual', async () => {
    server.use(
      http.get('/escala/efetiva', () => HttpResponse.json([])),
      http.get('/escala/excecoes', () => HttpResponse.json([])),
    )
    const user = userEvent.setup()
    renderPainel()

    await screen.findByText(ROTULO_MES_ATUAL)
    await user.click(screen.getByRole('tab', { name: 'Semana' }))

    // não afirma a data exata da semana (dependeria de saber em que dia da semana "hoje" cai) -
    // só que a visão de semana renderizou (cabeçalhos de dia da grade de horário aparecem)
    expect(await screen.findByLabelText(new RegExp(formatarDataBr(HOJE)))).toBeInTheDocument()
  })

  it('troca pra visão de dia e mostra o nome do dia da semana', async () => {
    server.use(
      http.get('/escala/efetiva', () => HttpResponse.json([])),
      http.get('/escala/excecoes', () => HttpResponse.json([])),
    )
    const user = userEvent.setup()
    renderPainel()

    await screen.findByText(ROTULO_MES_ATUAL)
    await user.click(screen.getByRole('tab', { name: 'Dia' }))

    expect(await screen.findByText(`${nomeDoDiaDaSemana(HOJE)}, ${formatarDataBr(HOJE)}`)).toBeInTheDocument()
  })

  it('clicar e arrastar na visão de dia cria uma exceção com o horário selecionado', async () => {
    server.use(
      http.get('/escala/efetiva', () => HttpResponse.json([])),
      http.get('/escala/excecoes', () => HttpResponse.json([])),
    )
    let corpoEnviado: unknown = null
    server.use(
      http.post('/escala/excecoes', async ({ request }) => {
        corpoEnviado = await request.json()
        return HttpResponse.json(
          { id: 1, data: HOJE, trabalha: true, horaInicio: '10:00:00', horaFim: '11:00:00', observacao: null },
          { status: 201 },
        )
      }),
    )
    const user = userEvent.setup()
    renderPainel()

    await screen.findByText(ROTULO_MES_ATUAL)
    await user.click(screen.getByRole('tab', { name: 'Dia' }))
    const coluna = await screen.findByLabelText(new RegExp(`${formatarDataBr(HOJE)}, sem trabalho`))
    // não simula o arraste em pixel aqui (isso já é coberto por CalendarioSemana.test.tsx) - só
    // confirma que o clique simples (via userEvent, que dispara pointerdown+pointerup) chega até
    // o formulário e salva
    await user.click(coluna)

    await screen.findByText(formatarDataBr(HOJE))
    await user.click(screen.getByRole('button', { name: /salvar/i }))

    expect(corpoEnviado).toMatchObject({ data: HOJE, trabalha: true })
  })

  it('navegar pro período anterior no modo mês mostra o mês anterior', async () => {
    server.use(
      http.get('/escala/efetiva', () => HttpResponse.json([])),
      http.get('/escala/excecoes', () => HttpResponse.json([])),
    )
    const user = userEvent.setup()
    renderPainel()

    await screen.findByText(ROTULO_MES_ATUAL)
    await user.click(screen.getByRole('button', { name: /período anterior/i }))

    const mesAnteriorIndex = mesDaData(HOJE) === 1 ? 11 : mesDaData(HOJE) - 2
    const anoDoMesAnterior = mesDaData(HOJE) === 1 ? anoDaData(HOJE) - 1 : anoDaData(HOJE)
    expect(await screen.findByText(`${NOMES_MESES[mesAnteriorIndex]} de ${anoDoMesAnterior}`)).toBeInTheDocument()
  })

  it('botão "Hoje" volta pro período atual depois de navegar', async () => {
    server.use(
      http.get('/escala/efetiva', () => HttpResponse.json([])),
      http.get('/escala/excecoes', () => HttpResponse.json([])),
    )
    const user = userEvent.setup()
    renderPainel()

    await screen.findByText(ROTULO_MES_ATUAL)
    await user.click(screen.getByRole('button', { name: /próximo período/i }))
    await user.click(screen.getByRole('button', { name: 'Hoje' }))

    expect(await screen.findByText(ROTULO_MES_ATUAL)).toBeInTheDocument()
  })
})
