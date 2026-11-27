import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { AprovacoesSkills } from './AprovacoesSkills'
import { DiffArquivo } from './DiffArquivo'
import type { Proposta, SkillDetalhe, SkillVersao } from './types'

const server = setupServer()
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

const proposta: Proposta = {
  slug: 'login-seguro', nomeSkill: 'Login seguro', numero: 3, autorNome: 'Ana', criadaEm: '2026-11-05T10:00:00Z', mensagem: 'ajuste',
}

function versao(numero: number, estado: 'PUBLICADA' | 'PROPOSTA', arquivos: { caminho: string; conteudo: string }[], extra: Partial<SkillVersao> = {}): SkillVersao {
  return {
    numero, estado, nome: 'Login seguro', descricao: 'd', categoria: 'SEGURANCA', promptUso: 'p', tutorialInstalacao: 't',
    mensagem: null, autorId: 1, autorNome: 'Ana', criadaEm: '2026-11-05T10:00:00Z', decididaPorNome: null, decididaEm: null, motivoRejeicao: null,
    arquivos, ...extra,
  }
}

const vigente = versao(2, 'PUBLICADA', [
  { caminho: 'SKILL.md', conteudo: 'linha um\nlinha dois\n' },
  { caminho: 'velho.md', conteudo: 'sai\n' },
])
const nova = versao(3, 'PROPOSTA', [
  { caminho: 'SKILL.md', conteudo: 'linha um\nlinha dois\nlinha NOVA\n' },
  { caminho: 'novo.md', conteudo: 'entra\n' },
], { nome: 'Login mais seguro' })
const detalhe: SkillDetalhe = { slug: 'login-seguro', oficial: false, arquivada: false, vigente, propostaPendente: null }

function usarServidor(propostas: Proposta[] = [proposta]) {
  server.use(
    http.get('/skills/propostas', () => HttpResponse.json(propostas)),
    http.get('/skills/login-seguro', () => HttpResponse.json(detalhe)),
    http.get('/skills/login-seguro/versoes/3', () => HttpResponse.json(nova)),
  )
}

function renderizar(aoVoltar = vi.fn()) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <AprovacoesSkills aoVoltar={aoVoltar} />
    </QueryClientProvider>,
  )
  return aoVoltar
}

describe('DiffArquivo', () => {
  it('marca linhas adicionadas e removidas', () => {
    const { container } = render(<DiffArquivo caminho="a.md" antes={'x\ny\n'} depois={'x\nz\n'} />)
    expect(container.querySelector('.diff-adicionada')).toHaveTextContent('z')
    expect(container.querySelector('.diff-removida')).toHaveTextContent('y')
  })

  it('indica arquivo novo e removido', () => {
    const { container, rerender } = render(<DiffArquivo caminho="a.md" antes={null} depois={'a\n'} />)
    expect(screen.getByText('novo')).toBeInTheDocument()
    expect(container.querySelector('.diff-adicionada')).toBeInTheDocument()
    rerender(<DiffArquivo caminho="a.md" antes={'a\n'} depois={null} />)
    expect(screen.getByText('removido')).toBeInTheDocument()
    expect(container.querySelector('.diff-removida')).toBeInTheDocument()
  })
})

describe('AprovacoesSkills', () => {
  it('lista as propostas da fila', async () => {
    usarServidor()
    renderizar()
    expect(await screen.findByText('Login seguro')).toBeInTheDocument()
    expect(screen.getByText(/Ana/)).toBeInTheDocument()
  })

  it('fila vazia mostra mensagem', async () => {
    usarServidor([])
    renderizar()
    expect(await screen.findByText('Nenhuma proposta pendente.')).toBeInTheDocument()
  })

  it('abrir proposta mostra diff por arquivo contra a vigente', async () => {
    usarServidor()
    renderizar()
    await userEvent.click(await screen.findByRole('button', { name: /Login seguro/ }))
    const linhaNova = await screen.findByText('linha NOVA')
    expect(linhaNova.closest('.diff-adicionada')).not.toBeNull()
    expect(screen.getByText('novo.md')).toBeInTheDocument()
    expect(screen.getByText('velho.md')).toBeInTheDocument()
    expect(screen.getByText('removido')).toBeInTheDocument()
    expect(screen.getByText('Login mais seguro').closest('.diff-adicionada')).not.toBeNull()
  })

  it('Aprovar chama POST aprovar e volta para a fila', async () => {
    usarServidor()
    let chamou = false
    server.use(http.post('/skills/login-seguro/versoes/3/aprovar', () => { chamou = true; return HttpResponse.json(nova) }))
    renderizar()
    await userEvent.click(await screen.findByRole('button', { name: /Login seguro/ }))
    await userEvent.click(await screen.findByRole('button', { name: 'Aprovar' }))
    await waitFor(() => expect(chamou).toBe(true))
    expect(await screen.findByRole('heading', { name: 'Aprovações' })).toBeInTheDocument()
  })

  it('Rejeitar exige motivo e envia o motivo', async () => {
    usarServidor()
    let corpo: unknown = null
    server.use(http.post('/skills/login-seguro/versoes/3/rejeitar', async ({ request }) => { corpo = await request.json(); return HttpResponse.json(nova) }))
    renderizar()
    await userEvent.click(await screen.findByRole('button', { name: /Login seguro/ }))
    await userEvent.click(await screen.findByRole('button', { name: 'Rejeitar' }))
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar rejeição' }))
    expect(await screen.findByText('Informe o motivo da rejeição.')).toBeInTheDocument()
    expect(corpo).toBeNull()
    await userEvent.type(screen.getByLabelText('Motivo da rejeição'), 'fora do padrão')
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar rejeição' }))
    await waitFor(() => expect(corpo).toEqual({ motivo: 'fora do padrão' }))
  })

  it('mostra a mensagem do erro 409 ao aprovar', async () => {
    usarServidor()
    server.use(http.post('/skills/login-seguro/versoes/3/aprovar', () => HttpResponse.json({ mensagem: 'Já decidida' }, { status: 409 })))
    renderizar()
    await userEvent.click(await screen.findByRole('button', { name: /Login seguro/ }))
    await userEvent.click(await screen.findByRole('button', { name: 'Aprovar' }))
    expect(await within(await screen.findByRole('alert')).findByText('Já decidida')).toBeInTheDocument()
  })

  it('409 ao aprovar invalida a fila e as skills para atualizar a tela', async () => {
    usarServidor()
    server.use(http.post('/skills/login-seguro/versoes/3/aprovar', () => HttpResponse.json({ mensagem: 'Já decidida' }, { status: 409 })))
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const spy = vi.spyOn(queryClient, 'invalidateQueries')
    render(
      <QueryClientProvider client={queryClient}>
        <AprovacoesSkills aoVoltar={vi.fn()} />
      </QueryClientProvider>,
    )
    await userEvent.click(await screen.findByRole('button', { name: /Login seguro/ }))
    await userEvent.click(await screen.findByRole('button', { name: 'Aprovar' }))
    await screen.findByText('Já decidida')
    expect(spy).toHaveBeenCalledWith({ queryKey: ['skills', 'propostas'] })
    expect(spy).toHaveBeenCalledWith({ queryKey: ['skills'] })
  })

  it('alternar entre aprovar e rejeitar limpa o erro anterior', async () => {
    usarServidor()
    server.use(http.post('/skills/login-seguro/versoes/3/aprovar', () => HttpResponse.json({ mensagem: 'Já decidida' }, { status: 409 })))
    renderizar()
    await userEvent.click(await screen.findByRole('button', { name: /Login seguro/ }))
    await userEvent.click(await screen.findByRole('button', { name: 'Aprovar' }))
    await screen.findByText('Já decidida')
    await userEvent.click(screen.getByRole('button', { name: 'Rejeitar' }))
    expect(screen.queryByText('Já decidida')).toBeNull()
  })

  it('o erro de motivo some ao digitar', async () => {
    usarServidor()
    renderizar()
    await userEvent.click(await screen.findByRole('button', { name: /Login seguro/ }))
    await userEvent.click(await screen.findByRole('button', { name: 'Rejeitar' }))
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar rejeição' }))
    await screen.findByText('Informe o motivo da rejeição.')
    await userEvent.type(screen.getByLabelText('Motivo da rejeição'), 'x')
    expect(screen.queryByText('Informe o motivo da rejeição.')).toBeNull()
  })
})
