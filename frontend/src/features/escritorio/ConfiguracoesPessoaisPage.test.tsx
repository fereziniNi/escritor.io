import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { ConfiguracoesPessoaisPage } from './ConfiguracoesPessoaisPage'

const server = setupServer(
  http.get('/usuarios/me', () => HttpResponse.json({ id: 1, nome: 'Ana Souza', email: 'ana@escritor.io', aparencia: { corPele: '#f2c9a0' } })),
  http.get('/escala/semanal', () => HttpResponse.json([])),
  http.get('/escala/efetiva', () => HttpResponse.json([])),
  http.get('/escala/excecoes', () => HttpResponse.json([])),
  http.get('/escala/reunioes', () => HttpResponse.json([])),
  http.get('/integracoes/google/estado', () => HttpResponse.json({ habilitado: false, conectado: false })),
)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

function renderPagina(abaInicial: 'personagem' | 'escala' | 'perfil' = 'escala') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <ConfiguracoesPessoaisPage abaInicial={abaInicial} aoEntrarNaReuniao={() => {}} />
    </QueryClientProvider>,
  )
}

/**
 * Pedido do usuário: "Esse agenda pessoal deve estar em configurações pessoais, ali a pessoa pode
 * editar até o personagem também e outras coisas" + "tenha também uma edição de perfil. Nome e
 * email nesse modal" - três abas (Personagem/Minha escala/Perfil), cada uma só reaproveitando um
 * componente já testado à parte (`EditorAvatarPage.test.tsx`/`EditarPerfilForm.test.tsx`/
 * `EscalaCalendarioPainel.test.tsx`) - aqui só a troca de aba em si.
 */
describe('ConfiguracoesPessoaisPage', () => {
  it('abre na aba indicada por abaInicial', async () => {
    renderPagina('personagem')

    expect(await screen.findByRole('tab', { name: /personagem/i, selected: true })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /minha escala/i, selected: false })).toBeInTheDocument()
  })

  it('troca pra aba Perfil e mostra o formulário de nome/e-mail', async () => {
    const user = userEvent.setup()
    renderPagina('escala')

    await user.click(screen.getByRole('tab', { name: /perfil/i }))

    expect(await screen.findByLabelText('Nome')).toHaveValue('Ana Souza')
    expect(screen.getByLabelText('E-mail')).toHaveValue('ana@escritor.io')
  })
})
