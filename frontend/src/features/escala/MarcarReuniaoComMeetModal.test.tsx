import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { setupServer } from 'msw/node'
import type { ComponentProps } from 'react'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { MarcarReuniaoComMeetModal } from './MarcarReuniaoComMeetModal'

const NOMES_POR_ID: Record<number, string> = { 1: 'Ana Souza', 2: 'Beto Lima' }

const server = setupServer(
  http.get('/usuarios/basico', () =>
    HttpResponse.json([
      { id: 1, nome: 'Ana Souza' },
      { id: 2, nome: 'Beto Lima' },
    ]),
  ),
  // permissivo por padrão (qualquer horário cabe) - os testes que precisam simular alguém
  // indisponível sobrescrevem isso com `server.use(...)`.
  http.get('/escala/disponibilidade', ({ request }) => {
    const ids = new URL(request.url).searchParams.getAll('usuarioIds').map(Number)
    return HttpResponse.json(
      ids.map((id) => ({ usuarioId: id, nome: NOMES_POR_ID[id] ?? `#${id}`, trabalha: true, horaInicio: '00:00:00', horaFim: '23:59:00' })),
    )
  }),
)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

function renderModal(props: Partial<ComponentProps<typeof MarcarReuniaoComMeetModal>> = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MarcarReuniaoComMeetModal aoFechar={() => {}} {...props} />
    </QueryClientProvider>,
  )
}

/**
 * Pedido do usuário: "quero adicionar de alguma forma integrada ao Google Meet/Calendar... onde o
 * usuário do sistema (independente) vai conseguir marcar e entrar nas reuniões do meet pela nossa
 * plataforma... deixar disponível para entrar na reunião com quem ele quer dos funcionários. Alem
 * de disponibilizar o link caso queira compartilhar". Depois, "Não consegui marcar a reunião!!
 * Mude o UI e UX da tela de marcar a reunião. Ficou péssimo!!" - os testes de disponibilidade
 * abaixo cobrem o motivo real do "não consegui" (nenhum aviso prévio de que o convidado não
 * trabalha naquele horário).
 */
describe('MarcarReuniaoComMeetModal', () => {
  it('lista as pessoas pra escolher como participante, filtrável por nome', async () => {
    const user = userEvent.setup()
    renderModal()

    expect(await screen.findByRole('checkbox', { name: 'Ana Souza' })).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Beto Lima' })).toBeInTheDocument()

    await user.type(screen.getByLabelText('Participantes'), 'Beto')

    expect(screen.queryByRole('checkbox', { name: 'Ana Souza' })).not.toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Beto Lima' })).toBeInTheDocument()
  })

  it('não deixa marcar sem escolher nenhum participante', async () => {
    renderModal()

    await screen.findByRole('checkbox', { name: 'Ana Souza' })

    expect(screen.getByRole('button', { name: /marcar reunião/i })).toBeDisabled()
  })

  it('pré-seleciona o participante e a data indicados', async () => {
    renderModal({ participanteInicialId: 2, dataInicial: '2026-03-10' })

    const checkboxBeto = await screen.findByRole('checkbox', { name: 'Beto Lima' })
    expect(checkboxBeto).toBeChecked()
    expect(screen.getByLabelText('Data')).toHaveValue('2026-03-10')
    expect(screen.getByRole('button', { name: /marcar reunião/i })).not.toBeDisabled()
  })

  it('cria a reunião e mostra o link do Meet com "Entrar no Meet"/"Copiar link"', async () => {
    let corpoEnviado: unknown = null
    server.use(
      http.post('/escala/reunioes', async ({ request }) => {
        corpoEnviado = await request.json()
        return HttpResponse.json(
          {
            id: 1,
            criadorId: 5,
            criadorNome: 'Ana',
            participantes: [{ id: 2, nome: 'Beto Lima' }],
            data: '2026-03-10',
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
    renderModal({ participanteInicialId: 2, dataInicial: '2026-03-10' })

    await screen.findByRole('checkbox', { name: 'Beto Lima' })
    await user.type(screen.getByLabelText('Título'), 'Alinhamento')
    await user.click(screen.getByRole('button', { name: /marcar reunião/i }))

    expect(corpoEnviado).toMatchObject({ participantesIds: [2], data: '2026-03-10', titulo: 'Alinhamento' })
    expect(await screen.findByRole('link', { name: /entrar no meet/i })).toHaveAttribute(
      'href',
      'https://meet.google.com/abc-defg-hij',
    )
    expect(screen.getByRole('button', { name: /copiar link/i })).toBeInTheDocument()
  })

  it('mostra um chip por participante escolhido, removível sem precisar achar o checkbox de novo', async () => {
    const user = userEvent.setup()
    renderModal()

    await user.click(await screen.findByRole('checkbox', { name: 'Ana Souza' }))
    expect(screen.getByText('Ana Souza', { selector: '.reuniao-chip' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /remover ana souza dos participantes/i }))

    expect(screen.queryByText('Ana Souza', { selector: '.reuniao-chip' })).not.toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Ana Souza' })).not.toBeChecked()
  })

  it('avisa antes de enviar quando o participante não trabalha no horário escolhido, e desabilita o botão', async () => {
    server.use(
      http.get('/escala/disponibilidade', () =>
        HttpResponse.json([{ usuarioId: 2, nome: 'Beto Lima', trabalha: false, horaInicio: null, horaFim: null }]),
      ),
    )
    renderModal({ participanteInicialId: 2, dataInicial: '2026-09-10' })

    expect(await screen.findByText(/beto lima não trabalha nesse dia/i)).toBeInTheDocument()
    expect(await screen.findByText(/ajuste o horário/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /marcar reunião/i })).toBeDisabled()
  })

  it('mostra erro quando o backend recusa por falta de conexão com o Google', async () => {
    server.use(http.post('/escala/reunioes', () => new HttpResponse(null, { status: 428 })))
    const user = userEvent.setup()
    renderModal({ participanteInicialId: 1 })

    await screen.findByRole('checkbox', { name: 'Ana Souza' })
    await user.type(screen.getByLabelText('Título'), 'Alinhamento')
    await user.click(screen.getByRole('button', { name: /marcar reunião/i }))

    expect(await screen.findByText(/conecte sua conta do google agenda/i)).toBeInTheDocument()
  })
})
