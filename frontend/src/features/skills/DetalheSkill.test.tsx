import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { DetalheSkill } from './DetalheSkill'
import type { SkillDetalhe, VersaoResumo } from './types'

const server = setupServer()
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  server.resetHandlers()
  vi.restoreAllMocks()
})
afterAll(() => server.close())

function detalhe(sobrescreve: Partial<SkillDetalhe> = {}): SkillDetalhe {
  return {
    slug: 'login-seguro',
    oficial: false,
    arquivada: false,
    propostaPendente: null,
    vigente: {
      numero: 2,
      estado: 'PUBLICADA',
      nome: 'Login seguro',
      descricao: 'Boas práticas de login',
      categoria: 'SEGURANCA',
      promptUso: 'Use a skill login-seguro',
      tutorialInstalacao: '# Instalar\n\npasso a passo\n\n<script id="x">alert(1)</script>',
      mensagem: null,
      autorNome: 'Ana',
      criadaEm: '2026-11-05T10:00:00Z',
      decididaPorNome: null,
      decididaEm: null,
      motivoRejeicao: null,
      arquivos: [
        { caminho: 'SKILL.md', conteudo: '---\nname: login-seguro\n---' },
        { caminho: 'ref/dicas.md', conteudo: 'conteudo das dicas' },
      ],
    },
    ...sobrescreve,
  }
}

const versoes: VersaoResumo[] = [
  {
    numero: 2, estado: 'PUBLICADA', nome: 'Login seguro', descricao: 'd', categoria: 'SEGURANCA', mensagem: 'ajuste',
    autorNome: 'Ana', criadaEm: '2026-11-05T10:00:00Z', decididaPorNome: null, decididaEm: null, motivoRejeicao: null,
  },
  {
    numero: 1, estado: 'REJEITADA', nome: 'Login seguro', descricao: 'd', categoria: 'SEGURANCA', mensagem: null,
    autorNome: 'Bia', criadaEm: '2026-11-04T10:00:00Z', decididaPorNome: 'Gil', decididaEm: '2026-11-04T11:00:00Z', motivoRejeicao: 'ruim',
  },
]

function usarServidor(d: SkillDetalhe = detalhe()) {
  server.use(
    http.get('/skills/login-seguro', () => HttpResponse.json(d)),
    http.get('/skills/login-seguro/versoes', () => HttpResponse.json(versoes)),
  )
}

function renderDetalhe(podeAprovar = false, props: { aoEditar?: () => void; aoVoltar?: () => void } = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <DetalheSkill slug="login-seguro" podeAprovar={podeAprovar} aoVoltar={props.aoVoltar ?? vi.fn()} aoEditar={props.aoEditar ?? vi.fn()} />
    </QueryClientProvider>,
  )
}

describe('DetalheSkill', () => {
  beforeEach(() => {
    URL.createObjectURL = vi.fn(() => 'blob:x')
    URL.revokeObjectURL = vi.fn()
  })

  it('mostra o prompt e copia para a área de transferência', async () => {
    usarServidor()
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    renderDetalhe()
    expect(await screen.findByText('Use a skill login-seguro')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Copiar prompt' }))
    expect(writeText).toHaveBeenCalledWith('Use a skill login-seguro')
    expect(await screen.findByText('Copiado!')).toBeInTheDocument()
  })

  it('sem clipboard, orienta a copiar manualmente', async () => {
    usarServidor()
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true })
    renderDetalhe()
    await screen.findByText('Use a skill login-seguro')
    await userEvent.click(screen.getByRole('button', { name: 'Copiar prompt' }))
    expect(await screen.findByText('Selecione e copie (Ctrl+C)')).toBeInTheDocument()
  })

  it('renderiza o tutorial e não cria elemento a partir de HTML bruto', async () => {
    usarServidor()
    const { container } = renderDetalhe()
    expect(await screen.findByRole('heading', { level: 2, name: 'Instalar' })).toBeInTheDocument()
    expect(container.querySelector('script')).toBeNull()
  })

  it('"Baixar .zip" chama /skills/<slug>/zip', async () => {
    usarServidor()
    let chamou = false
    server.use(
      http.get('/skills/login-seguro/zip', () => {
        chamou = true
        return new HttpResponse(new Uint8Array([80, 75]), { headers: { 'Content-Type': 'application/zip' } })
      }),
    )
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    renderDetalhe()
    await userEvent.click(await screen.findByRole('button', { name: 'Baixar .zip' }))
    await waitFor(() => expect(chamou).toBe(true))
  })

  it('aba Arquivos lista caminhos e mostra o conteúdo ao clicar', async () => {
    usarServidor()
    renderDetalhe()
    await userEvent.click(await screen.findByRole('tab', { name: 'Arquivos' }))
    await userEvent.click(screen.getByRole('button', { name: 'ref/dicas.md' }))
    expect(screen.getByText('conteudo das dicas')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'SKILL.md' })).toBeInTheDocument()
  })

  it('aba Histórico lista versões com estado e restaura', async () => {
    usarServidor()
    let chamou = false
    server.use(
      http.post('/skills/login-seguro/versoes/1/restaurar', () => {
        chamou = true
        return HttpResponse.json(detalhe().vigente)
      }),
    )
    renderDetalhe()
    await userEvent.click(await screen.findByRole('tab', { name: 'Histórico' }))
    expect(await screen.findByText('v2 · Publicada')).toBeInTheDocument()
    expect(screen.getByText('v1 · Rejeitada')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Restaurar v1' }))
    await waitFor(() => expect(chamou).toBe(true))
  })

  it('mostra a mensagem do servidor quando restaurar dá 409', async () => {
    usarServidor()
    server.use(
      http.post('/skills/login-seguro/versoes/1/restaurar', () => HttpResponse.json({ mensagem: 'Já há proposta de Bia' }, { status: 409 })),
    )
    renderDetalhe()
    await userEvent.click(await screen.findByRole('tab', { name: 'Histórico' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Restaurar v1' }))
    expect(await screen.findByText('Já há proposta de Bia')).toBeInTheDocument()
  })

  it('com podeAprovar mostra oficial/arquivar e chama o PUT', async () => {
    usarServidor()
    let corpo: unknown = null
    server.use(
      http.put('/skills/login-seguro/oficial', async ({ request }) => {
        corpo = await request.json()
        return new HttpResponse(null, { status: 204 })
      }),
    )
    renderDetalhe(true)
    expect(await screen.findByRole('button', { name: 'Arquivar' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Marcar como oficial' }))
    await waitFor(() => expect(corpo).toEqual({ valor: true }))
  })

  it('sem podeAprovar não mostra oficial/arquivar', async () => {
    usarServidor()
    renderDetalhe(false)
    await screen.findByText('Use a skill login-seguro')
    expect(screen.queryByRole('button', { name: 'Marcar como oficial' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Arquivar' })).not.toBeInTheDocument()
  })

  it('banner de proposta pendente e botão Editar', async () => {
    usarServidor(detalhe({ propostaPendente: versoes[1] }))
    const aoEditar = vi.fn()
    renderDetalhe(false, { aoEditar })
    expect(await screen.findByText('Há uma proposta de Bia aguardando aprovação')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Editar' }))
    expect(aoEditar).toHaveBeenCalled()
  })
})
