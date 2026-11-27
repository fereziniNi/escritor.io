import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { useAuthStore } from '../auth/authStore'
import { SkillsPainel } from './SkillsPainel'
import type { SkillDetalhe, SkillResumo, SkillVersao } from './types'

const server = setupServer()
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  server.resetHandlers()
  useAuthStore.setState({ accessToken: null, autenticado: false })
})
afterAll(() => server.close())

function logarComo(id: number) {
  const b64 = (o: object) => btoa(JSON.stringify(o)).replace(/=+$/, '')
  const token = `${b64({ alg: 'none' })}.${b64({ sub: String(id), papel: 'COLABORADOR', exp: 9999999999 })}.x`
  useAuthStore.setState({ accessToken: token, autenticado: true })
}

const SKILL_MD_VIGENTE = '---\nname: login-seguro\ndescription: vigente\n---\n'
const SKILL_MD_PROPOSTA = '---\nname: login-seguro\ndescription: da proposta\n---\n'

const vigente: SkillVersao = {
  numero: 2,
  estado: 'PUBLICADA',
  nome: 'Nome vigente',
  descricao: 'Descricao vigente',
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
  arquivos: [{ caminho: 'SKILL.md', conteudo: SKILL_MD_VIGENTE }],
}

const proposta: SkillVersao = {
  ...vigente,
  numero: 3,
  estado: 'PROPOSTA',
  nome: 'Nome da proposta',
  descricao: 'Descricao da proposta',
  autorId: 2,
  autorNome: 'Bia',
  arquivos: [{ caminho: 'SKILL.md', conteudo: SKILL_MD_PROPOSTA }],
}

const resumo: SkillResumo = {
  slug: 'login-seguro',
  nome: 'Nome vigente',
  descricao: 'Descricao vigente',
  categoria: 'SEGURANCA',
  oficial: true,
  arquivada: false,
  versaoVigente: 2,
  propostaPendente: true,
  atualizadaEm: '2026-11-05T10:00:00Z',
}

function usarServidor() {
  const detalhe: SkillDetalhe = {
    slug: 'login-seguro',
    oficial: true,
    arquivada: false,
    vigente,
    propostaPendente: { ...proposta, mensagem: 'mudei' },
  }
  server.use(
    http.get('/skills', () => HttpResponse.json([resumo])),
    http.get('/skills/login-seguro', () => HttpResponse.json(detalhe)),
    http.get('/skills/login-seguro/versoes/3', () => HttpResponse.json(proposta)),
  )
}

function renderPainel() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <SkillsPainel papel="COLABORADOR" />
    </QueryClientProvider>,
  )
}

async function abrirEditor() {
  await userEvent.click(await screen.findByRole('button', { name: /Nome vigente/ }))
  await userEvent.click(await screen.findByRole('button', { name: 'Editar' }))
}

describe('SkillsPainel: editor com proposta pendente', () => {
  it('o autor edita a própria proposta, não a vigente, com aviso', async () => {
    logarComo(2)
    usarServidor()
    renderPainel()
    await abrirEditor()
    expect(await screen.findByText('Você está editando sua proposta pendente (v3)')).toBeInTheDocument()
    expect(screen.getByLabelText('Nome')).toHaveValue('Nome da proposta')
    expect(screen.getByLabelText('Descrição')).toHaveValue('Descricao da proposta')
    expect(screen.getByLabelText('Conteúdo de SKILL.md')).toHaveValue(SKILL_MD_PROPOSTA)
  })

  it('proposta de outra pessoa: o editor não abre, só informa', async () => {
    logarComo(1)
    usarServidor()
    renderPainel()
    await userEvent.click(await screen.findByRole('button', { name: /Nome vigente/ }))
    await screen.findByRole('heading', { name: 'Nome vigente' })
    // Editar já vem desabilitado no detalhe; o guarda do editor cobre quem chegar lá por outro caminho.
    expect(screen.getByRole('button', { name: 'Editar' })).toBeDisabled()
  })
})
