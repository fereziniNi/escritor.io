import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { ChatMiniWidget } from './ChatMiniWidget'
import type { Conversa, Mensagem } from './types'

const GERAL: Conversa = { id: 1, tipo: 'GERAL', nome: 'Geral', ultimaMensagem: null, naoLidas: 3 }
const DM_COM_BETO: Conversa = {
  id: 2,
  tipo: 'DIRETA',
  nome: 'Beto Lima',
  ultimaMensagem: { id: 5, conversaId: 2, autorId: 2, autorNome: 'Beto Lima', texto: 'Oi!', criadoEm: '2026-01-15T09:00:00Z' },
  naoLidas: 0,
}

let conversas: Conversa[] = []
let mensagensPorConversa: Record<number, Mensagem[]> = {}

const server = setupServer(
  http.get('/chat/conversas', () => HttpResponse.json(conversas)),
  http.get('/chat/conversas/:id/mensagens', ({ params }) => HttpResponse.json(mensagensPorConversa[Number(params.id)] ?? [])),
  http.post('/chat/conversas/:id/lida', () => new HttpResponse(null, { status: 204 })),
  http.get('/usuarios/basico', () =>
    HttpResponse.json([
      { id: 1, nome: 'Ana Souza' },
      { id: 2, nome: 'Beto Lima' },
    ]),
  ),
)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  server.resetHandlers()
  conversas = []
  mensagensPorConversa = {}
})
afterAll(() => server.close())

function renderWidget(meuUsuarioId = 1) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <ChatMiniWidget meuUsuarioId={meuUsuarioId} />
    </QueryClientProvider>,
  )
}

/**
 * Pedido do usuário: "eu quero que voce deixe um mini chat aberto na lateral esquerda no topo,
 * igual ao tempo mas do lado esquerdo, onde tem as ultimas mensagens e pessoas, igual ao whats,
 * mas em miniatura igual um popup."
 */
describe('ChatMiniWidget', () => {
  it('mostra o cabeçalho e a lista de conversas (Geral incluída) aberta por padrão', async () => {
    conversas = [GERAL, DM_COM_BETO]
    renderWidget()

    expect(await screen.findByText('💬 Chat')).toBeInTheDocument()
    expect(await screen.findByText('Geral')).toBeInTheDocument()
    expect(screen.getByText('Beto Lima')).toBeInTheDocument()
    expect(screen.getByText(/beto lima: oi!/i)).toBeInTheDocument()
    expect(screen.getByLabelText('3 mensagens não lidas')).toHaveTextContent('3')
  })

  it('recolhe e expande de novo ao clicar no botão de recolher', async () => {
    conversas = [GERAL]
    const user = userEvent.setup()
    renderWidget()
    await screen.findByText('Geral')

    await user.click(screen.getByRole('button', { name: 'Recolher o chat' }))
    expect(screen.queryByText('Geral')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Expandir o chat' }))
    expect(await screen.findByText('Geral')).toBeInTheDocument()
  })

  it('abre uma conversa da lista, mostra as mensagens, e marca como lida', async () => {
    conversas = [GERAL]
    mensagensPorConversa = {
      1: [{ id: 10, conversaId: 1, autorId: 2, autorNome: 'Beto Lima', texto: 'Bom dia a todos!', criadoEm: '2026-01-15T09:00:00Z' }],
    }
    let marcouComoLida = false
    server.use(http.post('/chat/conversas/1/lida', () => {
      marcouComoLida = true
      return new HttpResponse(null, { status: 204 })
    }))
    const user = userEvent.setup()
    renderWidget()

    await user.click(await screen.findByRole('button', { name: /geral/i }))

    expect(await screen.findByText('Bom dia a todos!')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Voltar pra lista de conversas' })).toBeInTheDocument()
    await waitFor(() => expect(marcouComoLida).toBe(true))
  })

  it('volta pra lista ao clicar em "←"', async () => {
    conversas = [GERAL]
    mensagensPorConversa = { 1: [] }
    const user = userEvent.setup()
    renderWidget()

    await user.click(await screen.findByRole('button', { name: /geral/i }))
    await screen.findByText(/nenhuma mensagem ainda/i)

    await user.click(screen.getByRole('button', { name: 'Voltar pra lista de conversas' }))

    expect(await screen.findByText('💬 Chat')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /geral/i })).toBeInTheDocument()
  })

  it('envia uma mensagem na conversa aberta e ela aparece na lista imediatamente', async () => {
    conversas = [GERAL]
    mensagensPorConversa = { 1: [] }
    let corpoEnviado: unknown = null
    server.use(
      http.post('/chat/conversas/1/mensagens', async ({ request }) => {
        corpoEnviado = await request.json()
        return HttpResponse.json(
          { id: 99, conversaId: 1, autorId: 1, autorNome: 'Ana Souza', texto: 'Bom dia!', criadoEm: '2026-01-15T09:05:00Z' },
          { status: 201 },
        )
      }),
    )
    const user = userEvent.setup()
    renderWidget(1)

    await user.click(await screen.findByRole('button', { name: /geral/i }))
    await screen.findByText(/nenhuma mensagem ainda/i)
    await user.type(screen.getByLabelText('Mensagem'), 'Bom dia!')
    await user.click(screen.getByRole('button', { name: 'Enviar' }))

    expect(corpoEnviado).toEqual({ texto: 'Bom dia!' })
    expect(await screen.findByText('Bom dia!')).toBeInTheDocument()
  })

  it('abre "nova conversa", filtra por nome (sem listar a si mesmo) e inicia uma DM', async () => {
    conversas = [GERAL]
    mensagensPorConversa = { 1: [] }
    server.use(
      http.post('/chat/conversas/diretas/:usuarioId', ({ params }) => {
        const novaConversa: Conversa = { id: 7, tipo: 'DIRETA', nome: 'Beto Lima', ultimaMensagem: null, naoLidas: 0 }
        conversas = [...conversas, novaConversa]
        mensagensPorConversa[7] = []
        expect(params.usuarioId).toBe('2')
        return HttpResponse.json(novaConversa)
      }),
    )
    const user = userEvent.setup()
    renderWidget(1)
    await screen.findByText('Geral')

    await user.click(screen.getByRole('button', { name: 'Nova conversa' }))
    expect(screen.getByText('Nova conversa')).toBeInTheDocument()
    expect(screen.queryByText('Ana Souza')).not.toBeInTheDocument() // não lista quem já está conversando (eu mesmo)
    await user.type(screen.getByLabelText('Filtrar pessoas'), 'Beto')
    await user.click(screen.getByRole('button', { name: 'Beto Lima' }))

    await screen.findByText(/nenhuma mensagem ainda/i) // já entrou direto na conversa nova (vazia)
  })
})
