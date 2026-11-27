import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { ListaSkills } from './ListaSkills'
import type { SkillResumo } from './types'

const server = setupServer()
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

function skill(sobrescreve: Partial<SkillResumo> = {}): SkillResumo {
  return {
    slug: 'login-seguro',
    nome: 'Login seguro',
    descricao: 'Boas práticas de login',
    categoria: 'SEGURANCA',
    oficial: false,
    arquivada: false,
    versaoVigente: 1,
    propostaPendente: false,
    atualizadaEm: '2026-11-05T10:00:00Z',
    ...sobrescreve,
  }
}

function renderLista(podeAprovar = false, props: { aoAprovacoes?: () => void } = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <ListaSkills aoAbrir={vi.fn()} aoNova={vi.fn()} aoAprovacoes={props.aoAprovacoes ?? vi.fn()} podeAprovar={podeAprovar} />
    </QueryClientProvider>,
  )
}

describe('ListaSkills', () => {
  it('mostra nome, descrição e selo Oficial Multiplica', async () => {
    server.use(http.get('/skills', () => HttpResponse.json([skill({ oficial: true })])))
    renderLista()
    expect(await screen.findByText('Login seguro')).toBeInTheDocument()
    expect(screen.getByText('Boas práticas de login')).toBeInTheDocument()
    expect(screen.getByText(/Oficial Multiplica/)).toBeInTheDocument()
  })

  it('mostra o indicador de proposta pendente', async () => {
    server.use(http.get('/skills', () => HttpResponse.json([skill({ propostaPendente: true })])))
    renderLista()
    expect(await screen.findByText(/Proposta pendente/)).toBeInTheDocument()
  })

  it('chama /skills?busca=login ao digitar na busca', async () => {
    const buscas: (string | null)[] = []
    server.use(
      http.get('/skills', ({ request }) => {
        buscas.push(new URL(request.url).searchParams.get('busca'))
        return HttpResponse.json([])
      }),
    )
    renderLista()
    await userEvent.type(screen.getByLabelText('Buscar skills'), 'login')
    await waitFor(() => expect(buscas).toContain('login'), { timeout: 2000 })
    expect(buscas).not.toContain('l')
  })

  it('filtro "Só oficiais" envia oficial=true', async () => {
    const oficiais: (string | null)[] = []
    server.use(
      http.get('/skills', ({ request }) => {
        oficiais.push(new URL(request.url).searchParams.get('oficial'))
        return HttpResponse.json([])
      }),
    )
    renderLista()
    await userEvent.click(screen.getByLabelText('Só oficiais'))
    await waitFor(() => expect(oficiais).toContain('true'))
  })

  it('"Baixar todas as oficiais" chama /skills/oficiais.zip', async () => {
    let chamou = false
    server.use(
      http.get('/skills', () => HttpResponse.json([])),
      http.get('/skills/oficiais.zip', () => {
        chamou = true
        return new HttpResponse(new Uint8Array([80, 75]), { headers: { 'Content-Type': 'application/zip' } })
      }),
    )
    URL.createObjectURL = vi.fn(() => 'blob:x')
    URL.revokeObjectURL = vi.fn()
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    renderLista()
    await userEvent.click(screen.getByRole('button', { name: 'Baixar todas as oficiais' }))
    await waitFor(() => expect(chamou).toBe(true))
  })

  it('botão "Aprovações" só aparece com podeAprovar', async () => {
    server.use(http.get('/skills', () => HttpResponse.json([])))
    const { unmount } = renderLista(false)
    expect(screen.queryByRole('button', { name: /Aprovações/ })).not.toBeInTheDocument()
    unmount()
    renderLista(true)
    expect(screen.getByRole('button', { name: /Aprovações/ })).toBeInTheDocument()
  })

  it('mostra o rótulo "Segurança" no cartão e no select', async () => {
    server.use(http.get('/skills', () => HttpResponse.json([skill({ categoria: 'SEGURANCA' })])))
    renderLista()
    const cartao = await screen.findByRole('button', { name: /Login seguro/ })
    expect(within(cartao).getByText('Segurança')).toBeInTheDocument()
    expect(within(cartao).getByText('v1')).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Segurança' })).toBeInTheDocument()
    expect(screen.queryByText(/SEGURANCA/)).not.toBeInTheDocument()
  })

  it('mostra estado vazio', async () => {
    server.use(http.get('/skills', () => HttpResponse.json([])))
    renderLista()
    expect(await screen.findByText('Nenhuma skill encontrada.')).toBeInTheDocument()
  })
})
