import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { useAuthStore } from '../auth/authStore'
import { DetalheSkill } from './DetalheSkill'
import type { SkillDetalhe, SkillVersao, VersaoResumo } from './types'

const server = setupServer()
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  server.resetHandlers()
  useAuthStore.setState({ accessToken: null, autenticado: false })
})
afterAll(() => server.close())

/** JWT sem assinatura só com o `sub` (id do usuário), como o front o lê. */
function logarComo(id: number) {
  const b64 = (o: object) => btoa(JSON.stringify(o)).replace(/=+$/, '')
  const token = `${b64({ alg: 'none' })}.${b64({ sub: String(id), papel: 'COLABORADOR', exp: 9999999999 })}.x`
  useAuthStore.setState({ accessToken: token, autenticado: true })
}

const vigente: SkillVersao = {
  numero: 2,
  estado: 'PUBLICADA',
  nome: 'Login seguro',
  descricao: 'Boas práticas',
  categoria: 'SEGURANCA',
  promptUso: 'p',
  tutorialInstalacao: 't',
  mensagem: null,
  autorId: 1,
  autorNome: 'Ana',
  criadaEm: '2026-11-05T10:00:00Z',
  decididaPorNome: null,
  decididaEm: null,
  motivoRejeicao: null,
  arquivos: [
    { caminho: 'SKILL.md', conteudo: '# Titulo do doc\n\ntexto' },
    { caminho: 'src/a.ts', conteudo: '# nao e markdown' },
  ],
}

const resumoProposta: VersaoResumo = {
  numero: 3,
  estado: 'PROPOSTA',
  nome: 'Login seguro',
  descricao: 'd',
  categoria: 'SEGURANCA',
  mensagem: 'mudei',
  autorId: 2,
  autorNome: 'Bia',
  criadaEm: '2026-11-05T11:00:00Z',
  decididaPorNome: null,
  decididaEm: null,
  motivoRejeicao: null,
}

const versaoProposta: SkillVersao = {
  ...vigente,
  numero: 3,
  estado: 'PROPOSTA',
  autorId: 2,
  autorNome: 'Bia',
  arquivos: [{ caminho: 'SKILL.md', conteudo: '# Titulo do doc\n\nlinha NOVA da proposta' }],
}

function usarServidor(d: Partial<SkillDetalhe> = {}) {
  const detalhe: SkillDetalhe = { slug: 'login-seguro', oficial: false, arquivada: false, vigente, propostaPendente: null, ...d }
  server.use(
    http.get('/skills/login-seguro', () => HttpResponse.json(detalhe)),
    http.get('/skills/login-seguro/versoes', () => HttpResponse.json([resumoProposta, { ...resumoProposta, numero: 2, estado: 'PUBLICADA' }])),
    http.get('/skills/login-seguro/versoes/3', () => HttpResponse.json(versaoProposta)),
    http.get('/skills/login-seguro/versoes/2', () => HttpResponse.json({ ...vigente, arquivos: [{ caminho: 'velho.ts', conteudo: 'codigo antigo' }] })),
  )
}

function renderDetalhe(aoEditar = vi.fn()) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <DetalheSkill slug="login-seguro" podeAprovar={false} aoVoltar={vi.fn()} aoEditar={aoEditar} />
    </QueryClientProvider>,
  )
  return aoEditar
}

describe('DetalheSkill: arquivos e histórico', () => {
  it('aba Arquivos renderiza .md como markdown e mantém os demais em <pre>', async () => {
    usarServidor()
    renderDetalhe()
    await userEvent.click(await screen.findByRole('tab', { name: 'Arquivos' }))
    await userEvent.click(screen.getByRole('button', { name: 'SKILL.md' }))
    expect(await screen.findByRole('heading', { name: 'Titulo do doc' })).toBeInTheDocument()
    expect(document.querySelector('pre.skills-arquivo-conteudo')).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'src/a.ts' }))
    expect(document.querySelector('pre.skills-arquivo-conteudo')).toHaveTextContent('# nao e markdown')
    expect(screen.queryByRole('heading', { name: 'nao e markdown' })).toBeNull()
  })

  it('Histórico: Ver abre os arquivos daquela versão em somente leitura', async () => {
    usarServidor()
    renderDetalhe()
    await userEvent.click(await screen.findByRole('tab', { name: 'Histórico' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Ver v2' }))
    await userEvent.click(await screen.findByRole('button', { name: 'velho.ts' }))
    expect(await screen.findByText('codigo antigo')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Fechar versão' }))
    expect(screen.queryByText('codigo antigo')).toBeNull()
  })
})

describe('DetalheSkill: proposta pendente em skill oficial', () => {
  it('de outra pessoa: desabilita Editar e Restaurar com a explicação e oferece Ver proposta', async () => {
    logarComo(1)
    usarServidor({ oficial: true, propostaPendente: resumoProposta })
    const aoEditar = renderDetalhe()
    expect(await screen.findByText('Há uma proposta de Bia aguardando aprovação')).toBeInTheDocument()
    const editar = screen.getByRole('button', { name: 'Editar' })
    expect(editar).toBeDisabled()
    expect(editar).toHaveAttribute('title', 'Há uma proposta de Bia aguardando aprovação')
    await userEvent.click(editar)
    expect(aoEditar).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('tab', { name: 'Histórico' }))
    expect(await screen.findByRole('button', { name: 'Restaurar v2' })).toBeDisabled()
    await userEvent.click(screen.getByRole('button', { name: 'Ver proposta' }))
    expect(await screen.findByText('linha NOVA da proposta')).toBeInTheDocument()
  })

  it('do Sistema (sem autorId): também bloqueia', async () => {
    logarComo(1)
    usarServidor({ oficial: true, propostaPendente: { ...resumoProposta, autorId: null, autorNome: 'Sistema' } })
    renderDetalhe()
    await screen.findByText('Há uma proposta de Sistema aguardando aprovação')
    expect(screen.getByRole('button', { name: 'Editar' })).toBeDisabled()
  })

  it('do próprio autor: Editar continua habilitado', async () => {
    logarComo(2)
    usarServidor({ oficial: true, propostaPendente: resumoProposta })
    const aoEditar = renderDetalhe()
    await screen.findByText('Há uma proposta de Bia aguardando aprovação')
    await userEvent.click(screen.getByRole('button', { name: 'Editar' }))
    expect(aoEditar).toHaveBeenCalled()
  })
})
