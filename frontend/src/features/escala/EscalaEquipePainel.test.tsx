import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { EscalaEquipePainel } from './EscalaEquipePainel'

const server = setupServer(
  http.get('/escala/reunioes/equipe', () => HttpResponse.json([])),
  http.get('/usuarios/basico', () => HttpResponse.json([{ id: 1, nome: 'Ana Souza' }])),
)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

function renderPainel() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <EscalaEquipePainel />
    </QueryClientProvider>,
  )
}

describe('EscalaEquipePainel', () => {
  it('lista cada colaborador visível com o horário efetivo de cada dia da semana', async () => {
    server.use(
      http.get('/escala/equipe', () =>
        HttpResponse.json([
          {
            usuarioId: 1,
            usuarioNome: 'Ana Souza',
            dias: [
              { data: '2026-01-05', trabalha: true, horaInicio: '09:00:00', horaFim: '18:00:00' },
              { data: '2026-01-06', trabalha: false, horaInicio: null, horaFim: null },
            ],
          },
        ]),
      ),
    )

    renderPainel()

    const linha = (await screen.findByText('Ana Souza')).closest('tr')!
    expect(within(linha).getByText('09:00–18:00')).toBeInTheDocument()
    expect(within(linha).getByText('—')).toBeInTheDocument()
  })

  it('mostra mensagem vazia quando ninguém é visível', async () => {
    server.use(http.get('/escala/equipe', () => HttpResponse.json([])))

    renderPainel()

    expect(await screen.findByText(/ninguém visível pra você/i)).toBeInTheDocument()
  })

  it('mostra erro quando a consulta falha', async () => {
    server.use(http.get('/escala/equipe', () => new HttpResponse(null, { status: 500 })))

    renderPainel()

    expect(await screen.findByText(/não foi possível carregar a escala da equipe/i)).toBeInTheDocument()
  })

  it('navega pra semana seguinte e volta', async () => {
    let intervalosConsultados: string[] = []
    server.use(
      http.get('/escala/equipe', ({ request }) => {
        const url = new URL(request.url)
        intervalosConsultados.push(`${url.searchParams.get('inicio')}..${url.searchParams.get('fim')}`)
        return HttpResponse.json([])
      }),
    )
    const user = userEvent.setup()
    renderPainel()

    await screen.findByText(/ninguém visível pra você/i)
    const primeiroIntervalo = intervalosConsultados[0]

    await user.click(screen.getByLabelText(/próxima semana/i))
    await screen.findByText(/ninguém visível pra você/i)
    expect(intervalosConsultados[1]).not.toBe(primeiroIntervalo)

    await user.click(screen.getByLabelText(/semana anterior/i))
    await screen.findByText(/ninguém visível pra você/i)
    expect(intervalosConsultados.at(-1)).toBe(primeiroIntervalo)
  })

  // Pedido do usuário: "quero adicionar de alguma forma integrada ao Google Meet/Calendar...
  // deixar disponível para entrar na reunião com quem ele quer dos funcionários" - abaixo, os
  // testes da parte nova (célula clicável, chip, abrir `MarcarReuniaoComMeetModal` pré-preenchido).

  it('um dia sem trabalho não é clicável, mas um dia trabalhado vira um botão', async () => {
    server.use(
      http.get('/escala/equipe', () =>
        HttpResponse.json([
          {
            usuarioId: 1,
            usuarioNome: 'Ana Souza',
            dias: [
              { data: '2026-01-05', trabalha: true, horaInicio: '09:00:00', horaFim: '18:00:00' },
              { data: '2026-01-06', trabalha: false, horaInicio: null, horaFim: null },
            ],
          },
        ]),
      ),
    )

    renderPainel()

    const linha = (await screen.findByText('Ana Souza')).closest('tr')!
    expect(within(linha).getByText('—')).toBeInTheDocument()
    expect(within(linha).getByRole('button', { name: /09:00.*18:00/ })).toBeInTheDocument()
  })

  it('clicar numa célula de dia trabalhado abre o modal de marcar reunião com o participante pré-selecionado', async () => {
    server.use(
      http.get('/escala/equipe', () =>
        HttpResponse.json([
          { usuarioId: 1, usuarioNome: 'Ana Souza', dias: [{ data: '2026-01-05', trabalha: true, horaInicio: '09:00:00', horaFim: '18:00:00' }] },
        ]),
      ),
    )
    const user = userEvent.setup()
    renderPainel()

    await user.click(await screen.findByRole('button', { name: /09:00.*18:00/ }))

    const dialogo = await screen.findByRole('dialog', { name: /marcar reunião/i })
    expect(within(dialogo).getByRole('checkbox', { name: 'Ana Souza' })).toBeChecked()
  })

  it('mostra um chip pra cada reunião já marcada naquele dia', async () => {
    server.use(
      http.get('/escala/equipe', () =>
        HttpResponse.json([
          { usuarioId: 1, usuarioNome: 'Ana Souza', dias: [{ data: '2026-01-05', trabalha: true, horaInicio: '09:00:00', horaFim: '18:00:00' }] },
        ]),
      ),
      http.get('/escala/reunioes/equipe', () =>
        HttpResponse.json([
          {
            id: 1,
            criadorId: 2,
            criadorNome: 'Chefe',
            participantes: [{ id: 1, nome: 'Ana Souza' }],
            data: '2026-01-05',
            horaInicio: '14:30:00',
            horaFim: '15:00:00',
            titulo: 'Alinhamento',
            linkMeet: 'https://meet.google.com/abc-defg-hij',
          },
        ]),
      ),
    )
    renderPainel()

    expect(await screen.findByText(/Alinhamento/)).toBeInTheDocument()
  })

  it('marcar uma reunião chama a API com o participante e o horário certos', async () => {
    server.use(
      http.get('/escala/equipe', () =>
        HttpResponse.json([
          { usuarioId: 1, usuarioNome: 'Ana Souza', dias: [{ data: '2026-01-05', trabalha: true, horaInicio: '09:00:00', horaFim: '18:00:00' }] },
        ]),
      ),
    )
    let corpoEnviado: unknown = null
    server.use(
      http.post('/escala/reunioes', async ({ request }) => {
        corpoEnviado = await request.json()
        return HttpResponse.json(
          {
            id: 1,
            criadorId: 2,
            criadorNome: 'Chefe',
            participantes: [{ id: 1, nome: 'Ana Souza' }],
            data: '2026-01-05',
            horaInicio: '09:00:00',
            horaFim: '10:00:00',
            titulo: 'Alinhamento',
            linkMeet: 'https://meet.google.com/abc-defg-hij',
          },
          { status: 201 },
        )
      }),
    )
    const user = userEvent.setup()
    renderPainel()

    await user.click(await screen.findByRole('button', { name: /09:00.*18:00/ }))
    const dialogo = await screen.findByRole('dialog', { name: /marcar reunião/i })
    await user.type(within(dialogo).getByLabelText('Título'), 'Alinhamento')
    await user.click(within(dialogo).getByRole('button', { name: /marcar reunião/i }))

    expect(corpoEnviado).toMatchObject({ participantesIds: [1], data: '2026-01-05', titulo: 'Alinhamento' })
    expect(await within(dialogo).findByDisplayValue('https://meet.google.com/abc-defg-hij')).toBeInTheDocument()
  })

  it('deixa marcar um horário quebrado, fora dos passos de 30min', async () => {
    // pedido do usuário: "Gostaria que ele conseguisse marcar o horario quebrado... Tipo das 9:15
    // as 9:27" - campos de horário livres, sem `step`, aceitam qualquer minuto.
    server.use(
      http.get('/escala/equipe', () =>
        HttpResponse.json([
          { usuarioId: 1, usuarioNome: 'Ana Souza', dias: [{ data: '2026-01-05', trabalha: true, horaInicio: '09:00:00', horaFim: '18:00:00' }] },
        ]),
      ),
    )
    let corpoEnviado: unknown = null
    server.use(
      http.post('/escala/reunioes', async ({ request }) => {
        corpoEnviado = await request.json()
        return HttpResponse.json(
          {
            id: 1,
            criadorId: 2,
            criadorNome: 'Chefe',
            participantes: [{ id: 1, nome: 'Ana Souza' }],
            data: '2026-01-05',
            horaInicio: '09:15:00',
            horaFim: '09:27:00',
            titulo: 'Alinhamento rápido',
            linkMeet: 'https://meet.google.com/abc-defg-hij',
          },
          { status: 201 },
        )
      }),
    )
    const user = userEvent.setup()
    renderPainel()

    await user.click(await screen.findByRole('button', { name: /09:00.*18:00/ }))
    const dialogo = await screen.findByRole('dialog', { name: /marcar reunião/i })
    const campoInicio = within(dialogo).getByLabelText('Início')
    const campoFim = within(dialogo).getByLabelText('Fim')
    await user.clear(campoInicio)
    await user.type(campoInicio, '09:15')
    await user.clear(campoFim)
    await user.type(campoFim, '09:27')
    await user.type(within(dialogo).getByLabelText('Título'), 'Alinhamento rápido')
    await user.click(within(dialogo).getByRole('button', { name: /marcar reunião/i }))

    expect(corpoEnviado).toMatchObject({ horaInicio: '09:15:00', horaFim: '09:27:00' })
  })
})
