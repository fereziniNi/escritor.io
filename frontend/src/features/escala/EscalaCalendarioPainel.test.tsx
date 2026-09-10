import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { formatarDataBr } from '../../shared/formatarData'
import { useAuthStore } from '../auth/authStore'
import { anoDaData, dataDeHoje, mesDaData, nomeDoDiaDaSemana } from './datasEscala'
import { EscalaCalendarioPainel } from './EscalaCalendarioPainel'

const server = setupServer(http.get('/escala/reunioes', () => HttpResponse.json([])))

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

const ESTADO_INICIAL = useAuthStore.getState()

function base64UrlEncode(json: object): string {
  const base64 = btoa(JSON.stringify(json))
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function tokenFalsoCom(sub: string): string {
  const header = base64UrlEncode({ alg: 'HS512' })
  const corpo = base64UrlEncode({ sub, papel: 'COLABORADOR', exp: 1999999999 })
  return `${header}.${corpo}.assinatura-nao-importa-aqui`
}

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

function renderPainel(aoEntrarNaReuniao: () => void = () => {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <EscalaCalendarioPainel aoEntrarNaReuniao={aoEntrarNaReuniao} />
    </QueryClientProvider>,
  )
}

describe('EscalaCalendarioPainel', () => {
  afterEach(() => useAuthStore.setState(ESTADO_INICIAL, true))

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

  it('a agenda do dia mostra uma reunião marcada pelo chefe, por cima do bloco de trabalho', async () => {
    // pedido do usuário: "A reunião tem preioridade no lugar do trabalhando. Então se marcar das
    // 14:30 a reuniao ate as 15:00 deve aparecer esse intervalo no calendario"
    server.use(
      http.get('/escala/efetiva', () =>
        HttpResponse.json([{ data: HOJE, trabalha: true, horaInicio: '09:00:00', horaFim: '18:00:00' }]),
      ),
      http.get('/escala/excecoes', () => HttpResponse.json([])),
      http.get('/escala/reunioes', () =>
        HttpResponse.json([
          {
            id: 1,
            criadorId: 2,
            criadorNome: 'Chefe',
            participantes: [{ id: 1, nome: 'Ana' }],
            data: HOJE,
            horaInicio: '14:30:00',
            horaFim: '15:00:00',
            titulo: 'Alinhamento',
            linkMeet: 'https://meet.google.com/abc-defg-hij',
          },
        ]),
      ),
    )
    const user = userEvent.setup()
    renderPainel()

    await screen.findByText(ROTULO_MES_ATUAL)
    await user.click(await screen.findByRole('button', { name: formatarDataBr(HOJE) }))

    expect(await screen.findByText(/Alinhamento/)).toBeInTheDocument()
  })

  it('clicar numa reunião marcada e depois em "Entrar na sala do escritório" chama o callback', async () => {
    // pedido do usuário (sessão anterior): "onde está o link da reunião para eu entrar? Preciso
    // entrar no google?" - o teleporte pro escritório virtual continua existindo, ao lado do Meet.
    server.use(
      http.get('/escala/efetiva', () =>
        HttpResponse.json([{ data: HOJE, trabalha: true, horaInicio: '09:00:00', horaFim: '18:00:00' }]),
      ),
      http.get('/escala/excecoes', () => HttpResponse.json([])),
      http.get('/escala/reunioes', () =>
        HttpResponse.json([
          {
            id: 1,
            criadorId: 2,
            criadorNome: 'Chefe',
            participantes: [{ id: 1, nome: 'Ana' }],
            data: HOJE,
            horaInicio: '14:30:00',
            horaFim: '15:00:00',
            titulo: 'Alinhamento',
            linkMeet: 'https://meet.google.com/abc-defg-hij',
          },
        ]),
      ),
    )
    const aoEntrarNaReuniao = vi.fn()
    const user = userEvent.setup()
    renderPainel(aoEntrarNaReuniao)

    await screen.findByText(ROTULO_MES_ATUAL)
    await user.click(await screen.findByRole('button', { name: formatarDataBr(HOJE) }))
    await user.click(await screen.findByText(/Alinhamento/))
    await user.click(screen.getByRole('button', { name: /entrar na sala do escritório/i }))

    expect(aoEntrarNaReuniao).toHaveBeenCalledOnce()
  })

  it('mostra o link do Meet com um jeito de entrar/copiar, e sem botão de cancelar pra quem não criou', async () => {
    // pedido do usuário: "quero adicionar de alguma forma integrada ao Google Meet... disponibilizar
    // o link caso queira compartilhar"
    server.use(
      http.get('/escala/efetiva', () =>
        HttpResponse.json([{ data: HOJE, trabalha: true, horaInicio: '09:00:00', horaFim: '18:00:00' }]),
      ),
      http.get('/escala/excecoes', () => HttpResponse.json([])),
      http.get('/escala/reunioes', () =>
        HttpResponse.json([
          {
            id: 1,
            criadorId: 2,
            criadorNome: 'Chefe',
            participantes: [{ id: 1, nome: 'Ana' }],
            data: HOJE,
            horaInicio: '14:30:00',
            horaFim: '15:00:00',
            titulo: 'Alinhamento',
            linkMeet: 'https://meet.google.com/abc-defg-hij',
          },
        ]),
      ),
    )
    useAuthStore.getState().definirSessao(tokenFalsoCom('1'), 'COLABORADOR') // sou o participante (id 1), não o criador (id 2)
    const user = userEvent.setup()
    renderPainel()

    await screen.findByText(ROTULO_MES_ATUAL)
    await user.click(await screen.findByRole('button', { name: formatarDataBr(HOJE) }))
    await user.click(await screen.findByText(/Alinhamento/))

    expect(screen.getByRole('link', { name: /entrar no meet/i })).toHaveAttribute('href', 'https://meet.google.com/abc-defg-hij')
    expect(screen.getByRole('button', { name: /copiar link/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /cancelar reunião/i })).not.toBeInTheDocument()
  })

  it('mostra o botão de cancelar só pra quem criou a reunião', async () => {
    server.use(
      http.get('/escala/efetiva', () =>
        HttpResponse.json([{ data: HOJE, trabalha: true, horaInicio: '09:00:00', horaFim: '18:00:00' }]),
      ),
      http.get('/escala/excecoes', () => HttpResponse.json([])),
      http.get('/escala/reunioes', () =>
        HttpResponse.json([
          {
            id: 1,
            criadorId: 1,
            criadorNome: 'Ana',
            participantes: [{ id: 2, nome: 'Beto' }],
            data: HOJE,
            horaInicio: '14:30:00',
            horaFim: '15:00:00',
            titulo: 'Alinhamento',
            linkMeet: 'https://meet.google.com/abc-defg-hij',
          },
        ]),
      ),
    )
    useAuthStore.getState().definirSessao(tokenFalsoCom('1'), 'COLABORADOR') // sou a criadora (id 1)
    const user = userEvent.setup()
    renderPainel()

    await screen.findByText(ROTULO_MES_ATUAL)
    await user.click(await screen.findByRole('button', { name: formatarDataBr(HOJE) }))
    await user.click(await screen.findByText(/Alinhamento/))

    expect(screen.getByRole('button', { name: /cancelar reunião/i })).toBeInTheDocument()
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
