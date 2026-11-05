import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { setupServer } from 'msw/node'
import type { ComponentProps } from 'react'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { EditorSkill } from './EditorSkill'
import type { SkillVersao } from './types'

const server = setupServer()
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  vi.useRealTimers()
  server.resetHandlers()
})
afterAll(() => server.close())

const inicial: SkillVersao = {
  numero: 2,
  estado: 'PUBLICADA',
  nome: 'Login seguro',
  descricao: 'Boas práticas',
  categoria: 'SEGURANCA',
  promptUso: 'use',
  tutorialInstalacao: 'tut',
  mensagem: null,
  autorNome: 'Ana',
  criadaEm: '2026-11-05T10:00:00Z',
  decididaPorNome: null,
  decididaEm: null,
  motivoRejeicao: null,
  arquivos: [
    { caminho: 'SKILL.md', conteudo: '---\nname: login-seguro\ndescription: x\n---' },
    { caminho: 'ref/dicas.md', conteudo: 'dicas' },
  ],
}

function renderizar(props: Partial<ComponentProps<typeof EditorSkill>> = {}) {
  const aoSalvar = vi.fn()
  const aoCancelar = vi.fn()
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <EditorSkill slug="login-seguro" oficial={false} inicial={inicial} aoSalvar={aoSalvar} aoCancelar={aoCancelar} {...props} />
    </QueryClientProvider>,
  )
  return { aoSalvar, aoCancelar, client }
}

const botaoSalvar = () => screen.getByRole('button', { name: 'Salvar' })

describe('EditorSkill', () => {
  it('exige a mensagem da alteração para habilitar o salvar', async () => {
    renderizar()
    expect(botaoSalvar()).toBeDisabled()
    await userEvent.type(screen.getByLabelText('Mensagem da alteração'), 'ajuste')
    expect(botaoSalvar()).toBeEnabled()
  })

  it('SKILL.md não tem botão remover, os outros têm', () => {
    renderizar()
    expect(screen.queryByRole('button', { name: 'Remover SKILL.md' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Remover ref/dicas.md' })).toBeInTheDocument()
  })

  it('adiciona, renomeia e remove arquivos, enviando o resultado', async () => {
    let corpo: { arquivos: { caminho: string; conteudo: string }[] } | null = null
    server.use(
      http.post('*/skills/login-seguro/versoes', async ({ request }) => {
        corpo = (await request.json()) as typeof corpo
        return HttpResponse.json({ ...inicial, numero: 3 })
      }),
    )
    const { aoSalvar } = renderizar()
    await userEvent.type(screen.getByLabelText('Novo arquivo'), 'extra.md')
    await userEvent.click(screen.getByRole('button', { name: 'Adicionar arquivo' }))
    const caminhoDicas = screen.getByLabelText('Caminho de ref/dicas.md')
    await userEvent.clear(caminhoDicas)
    await userEvent.type(caminhoDicas, 'ref/novo.md')
    await userEvent.click(screen.getByRole('button', { name: 'Remover extra.md' }))
    await userEvent.type(screen.getByLabelText('Mensagem da alteração'), 'ajuste')
    await userEvent.click(botaoSalvar())
    await waitFor(() => expect(aoSalvar).toHaveBeenCalled())
    expect(corpo!.arquivos.map((a) => a.caminho)).toEqual(['SKILL.md', 'ref/novo.md'])
  })

  it('caminho com .. mostra erro e bloqueia o salvar', async () => {
    renderizar()
    await userEvent.type(screen.getByLabelText('Mensagem da alteração'), 'ajuste')
    const caminho = screen.getByLabelText('Caminho de ref/dicas.md')
    await userEvent.clear(caminho)
    await userEvent.type(caminho, '../x')
    expect(screen.getByText(/Caminho de arquivo inválido: \.\.\/x/)).toBeInTheDocument()
    expect(botaoSalvar()).toBeDisabled()
  })

  it('arquivo acima de 256 KB bloqueia o salvar', async () => {
    renderizar()
    await userEvent.type(screen.getByLabelText('Mensagem da alteração'), 'ajuste')
    const area = screen.getByLabelText('Conteúdo de ref/dicas.md')
    await userEvent.click(area)
    await userEvent.paste('ç'.repeat(140000))
    expect(screen.getByText(/excede o limite de 256 KB/)).toBeInTheDocument()
    expect(botaoSalvar()).toBeDisabled()
  })

  it('arquivo renomeado para SKILL.md continua editável e dá para corrigir e salvar', async () => {
    server.use(http.post('*/skills/login-seguro/versoes', () => HttpResponse.json({ ...inicial, numero: 3 })))
    const { aoSalvar } = renderizar()
    await userEvent.type(screen.getByLabelText('Mensagem da alteração'), 'ajuste')
    const caminho = screen.getByLabelText('Caminho de ref/dicas.md')
    await userEvent.clear(caminho)
    await userEvent.type(caminho, 'SKILL.md')
    expect(screen.getByText('Caminho duplicado: SKILL.md')).toBeInTheDocument()
    expect(botaoSalvar()).toBeDisabled()
    expect(screen.getAllByRole('button', { name: 'Remover SKILL.md' })).toHaveLength(1)
    const duplicado = screen.getAllByLabelText('Caminho de SKILL.md')[1]
    await userEvent.clear(duplicado)
    await userEvent.type(duplicado, 'ref/ok.md')
    expect(botaoSalvar()).toBeEnabled()
    await userEvent.click(botaoSalvar())
    await waitFor(() => expect(aoSalvar).toHaveBeenCalled())
  })

  it('arquivo adicionado como SKILL.md pode ser removido e o salvar volta', async () => {
    renderizar()
    await userEvent.type(screen.getByLabelText('Mensagem da alteração'), 'ajuste')
    await userEvent.type(screen.getByLabelText('Novo arquivo'), 'SKILL.md')
    await userEvent.click(screen.getByRole('button', { name: 'Adicionar arquivo' }))
    expect(botaoSalvar()).toBeDisabled()
    await userEvent.click(screen.getByRole('button', { name: 'Remover SKILL.md' }))
    expect(botaoSalvar()).toBeEnabled()
  })

  it('editar depois de um erro do servidor limpa a mensagem de erro', async () => {
    server.use(http.post('*/skills/login-seguro/versoes', () => HttpResponse.json({ mensagem: 'Deu ruim' }, { status: 400 })))
    renderizar()
    await userEvent.type(screen.getByLabelText('Mensagem da alteração'), 'ajuste')
    await userEvent.click(botaoSalvar())
    expect(await screen.findByText('Deu ruim')).toBeInTheDocument()
    await userEvent.type(screen.getByLabelText('Mensagem da alteração'), '!')
    expect(screen.queryByText('Deu ruim')).not.toBeInTheDocument()
  })

  it('skill oficial mostra o aviso e, ao receber PROPOSTA, confirma o envio', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    server.use(
      http.post('*/skills/login-seguro/versoes', () => HttpResponse.json({ ...inicial, numero: 3, estado: 'PROPOSTA' })),
    )
    const { aoSalvar } = renderizar({ oficial: true })
    expect(screen.getByText('Esta skill é oficial: sua alteração vai para aprovação.')).toBeInTheDocument()
    await userEvent.type(screen.getByLabelText('Mensagem da alteração'), 'ajuste')
    await userEvent.click(botaoSalvar())
    expect(await screen.findByText('Proposta enviada para aprovação')).toBeInTheDocument()
    expect(aoSalvar).not.toHaveBeenCalled()
    await act(async () => {
      vi.advanceTimersByTime(1600)
    })
    expect(aoSalvar).toHaveBeenCalledWith(expect.objectContaining({ estado: 'PROPOSTA' }), 'login-seguro')
  })

  it('publicada invalida o cache e chama aoSalvar', async () => {
    server.use(http.post('*/skills/login-seguro/versoes', () => HttpResponse.json({ ...inicial, numero: 3 })))
    const { aoSalvar, client } = renderizar()
    const spy = vi.spyOn(client, 'invalidateQueries')
    await userEvent.type(screen.getByLabelText('Mensagem da alteração'), 'ajuste')
    await userEvent.click(botaoSalvar())
    await waitFor(() => expect(aoSalvar).toHaveBeenCalled())
    expect(spy).toHaveBeenCalledWith({ queryKey: ['skills'] })
  })

  it.each([400, 409])('erro %i do servidor mostra a mensagem e mantém o texto', async (status) => {
    server.use(http.post('*/skills/login-seguro/versoes', () => HttpResponse.json({ mensagem: 'Deu ruim' }, { status })))
    const { aoSalvar } = renderizar()
    await userEvent.type(screen.getByLabelText('Mensagem da alteração'), 'ajuste')
    await userEvent.click(botaoSalvar())
    expect(await screen.findByText('Deu ruim')).toBeInTheDocument()
    expect(screen.getByLabelText('Mensagem da alteração')).toHaveValue('ajuste')
    expect(aoSalvar).not.toHaveBeenCalled()
  })

  it('criação: slug visível, modelo do SKILL.md acompanha o slug e envia POST /skills', async () => {
    let corpo: Record<string, unknown> | null = null
    server.use(
      http.post('*/skills', async ({ request }) => {
        corpo = (await request.json()) as typeof corpo
        return HttpResponse.json({ ...inicial, numero: 1 })
      }),
    )
    const { aoSalvar } = renderizar({ slug: undefined, inicial: undefined })
    await userEvent.type(screen.getByLabelText('Slug'), 'minha-skill')
    await userEvent.type(screen.getByLabelText('Nome'), 'Minha')
    expect(screen.getByLabelText('Conteúdo de SKILL.md')).toHaveValue('---\nname: minha-skill\ndescription: \n---\n\n# Minha\n')
    await userEvent.type(screen.getByLabelText('Descrição'), 'desc')
    await userEvent.type(screen.getByLabelText('Mensagem da alteração'), 'primeira')
    await userEvent.click(botaoSalvar())
    await waitFor(() => expect(aoSalvar).toHaveBeenCalled())
    expect(corpo).toMatchObject({ slug: 'minha-skill', nome: 'Minha', descricao: 'desc', categoria: 'OUTRAS' })
  })

  it('depois de editar o SKILL.md manualmente, o name deixa de acompanhar o slug', async () => {
    renderizar({ slug: undefined, inicial: undefined })
    await userEvent.type(screen.getByLabelText('Slug'), 'abc')
    await userEvent.type(screen.getByLabelText('Conteúdo de SKILL.md'), 'x')
    await userEvent.type(screen.getByLabelText('Slug'), 'd')
    expect((screen.getByLabelText('Conteúdo de SKILL.md') as HTMLTextAreaElement).value).toContain('name: abc\n')
  })

  it('slug inválido mostra erro e bloqueia o salvar', async () => {
    renderizar({ slug: undefined, inicial: undefined })
    await userEvent.type(screen.getByLabelText('Slug'), 'Ab')
    expect(screen.getByText(/O slug deve ter de 3 a 64 caracteres/)).toBeInTheDocument()
    expect(botaoSalvar()).toBeDisabled()
  })

  it('cancelar chama aoCancelar', async () => {
    const { aoCancelar } = renderizar()
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(aoCancelar).toHaveBeenCalled()
  })
})
