import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuthStore } from '../auth/authStore'
import { MinhasTarefasPainel } from './MinhasTarefasPainel'
import type { Tarefa } from './types'

const server = setupServer()

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

const ESTADO_INICIAL = useAuthStore.getState()

beforeEach(() => {
  useAuthStore.setState(ESTADO_INICIAL, true)
  useAuthStore.getState().definirSessao('token-fake', 'COLABORADOR')
})

function tarefa(parcial: Partial<Tarefa>): Tarefa {
  return {
    cardId: 1,
    titulo: 'Tarefa',
    projetoId: 10,
    projetoNome: 'Projeto Alfa',
    pessoal: false,
    estado: 'A_FAZER',
    prazo: null,
    estimativaMinutos: null,
    concluidoEm: null,
    estadosDisponiveis: ['A_FAZER', 'EM_ANDAMENTO', 'FEITO'],
    ...parcial,
  }
}

const PROJETOS = [
  { id: 10, nome: 'Projeto Alfa', cliente: 'X', status: 'ATIVO', inicio: '2026-01-01', fimPrevisto: null },
  { id: 20, nome: 'Projeto Beta', cliente: 'Y', status: 'ATIVO', inicio: '2026-01-01', fimPrevisto: null },
]

function mockar(tarefas: Tarefa[]) {
  server.use(
    http.get('/tarefas/minhas', () => HttpResponse.json(tarefas)),
    http.get('/projetos', () => HttpResponse.json(PROJETOS)),
  )
}

function renderPainel(aoAbrirTarefa: (p: number, c: number) => void = () => {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MinhasTarefasPainel aoAbrirTarefa={aoAbrirTarefa} />
    </QueryClientProvider>,
  )
}

function dataLocal(deslocamentoDias: number): string {
  const d = new Date()
  d.setDate(d.getDate() + deslocamentoDias)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

describe('MinhasTarefasPainel', () => {
  it('agrupaPorEstadoComEtiquetaDoProjeto', async () => {
    mockar([
      tarefa({ cardId: 1, titulo: 'Escrever capítulo', estado: 'A_FAZER' }),
      tarefa({ cardId: 2, titulo: 'Revisar texto', estado: 'EM_ANDAMENTO' }),
      tarefa({ cardId: 3, titulo: 'Comprar café', estado: 'A_FAZER', pessoal: true, projetoNome: null }),
      tarefa({ cardId: 4, titulo: 'Entregar rascunho', estado: 'FEITO' }),
    ])
    renderPainel()

    const aFazer = await screen.findByRole('region', { name: 'A fazer' })
    expect(within(aFazer).getByText('Escrever capítulo')).toBeInTheDocument()
    expect(within(aFazer).getByText('Comprar café')).toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: 'Em andamento' })).getByText('Revisar texto')).toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: 'Feito' })).getByText('Entregar rascunho')).toBeInTheDocument()

    const itemProjeto = screen.getByText('Escrever capítulo').closest('li')!
    expect(within(itemProjeto).getByText('Projeto Alfa')).toBeInTheDocument()
    const itemPessoal = screen.getByText('Comprar café').closest('li')!
    expect(within(itemPessoal).queryByText('Projeto Alfa')).not.toBeInTheDocument()
    expect(itemPessoal.querySelector('.tarefa-etiqueta')).toBeNull()
  })

  it('prazoVencidoOuHojeFicaEmVermelho', async () => {
    mockar([
      tarefa({ cardId: 1, titulo: 'Atrasada', prazo: dataLocal(-1) }),
      tarefa({ cardId: 2, titulo: 'Hoje', prazo: dataLocal(0) }),
      tarefa({ cardId: 3, titulo: 'Futura', prazo: dataLocal(5) }),
    ])
    renderPainel()

    await screen.findByText('Atrasada')
    const prazoDe = (t: string) => screen.getByText(t).closest('li')!.querySelector('.tarefa-prazo')!
    expect(prazoDe('Atrasada')).toHaveClass('tarefa-prazo--urgente')
    expect(prazoDe('Hoje')).toHaveClass('tarefa-prazo--urgente')
    expect(prazoDe('Futura')).not.toHaveClass('tarefa-prazo--urgente')
  })

  it('tarefaFeitaComPrazoVencidoNaoFicaEmVermelho', async () => {
    mockar([tarefa({ cardId: 1, titulo: 'Entregue', prazo: dataLocal(-1), estado: 'FEITO' })])
    renderPainel()

    await screen.findByText('Entregue')
    const prazo = screen.getByText('Entregue').closest('li')!.querySelector('.tarefa-prazo')!
    expect(prazo).not.toHaveClass('tarefa-prazo--urgente')
  })

  it('feitoVemRecolhidoEAbreAoClicar', async () => {
    mockar([tarefa({ cardId: 4, titulo: 'Entregar rascunho', estado: 'FEITO' })])
    const user = userEvent.setup()
    renderPainel()

    const detalhes = (await screen.findByText('Entregar rascunho')).closest('details')!
    expect(detalhes).not.toHaveAttribute('open')
    await user.click(within(detalhes).getByText(/^Feito/, { selector: 'summary' }))
    expect(detalhes).toHaveAttribute('open')
  })

  it('filtraPorProjetoEPorSemProjeto', async () => {
    mockar([
      tarefa({ cardId: 1, titulo: 'Da Alfa', projetoId: 10, projetoNome: 'Projeto Alfa' }),
      tarefa({ cardId: 2, titulo: 'Da Beta', projetoId: 20, projetoNome: 'Projeto Beta' }),
      tarefa({ cardId: 3, titulo: 'Pessoal', pessoal: true, projetoNome: null, projetoId: 30 }),
    ])
    const user = userEvent.setup()
    renderPainel()

    await screen.findByText('Da Alfa')
    const filtro = screen.getByLabelText('Filtrar por projeto')
    await user.selectOptions(filtro, 'Projeto Beta')
    expect(screen.queryByText('Da Alfa')).not.toBeInTheDocument()
    expect(screen.getByText('Da Beta')).toBeInTheDocument()
    expect(screen.queryByText('Pessoal')).not.toBeInTheDocument()

    await user.selectOptions(filtro, 'Sem projeto')
    expect(screen.getByText('Pessoal')).toBeInTheDocument()
    expect(screen.queryByText('Da Beta')).not.toBeInTheDocument()

    await user.selectOptions(filtro, 'Todos')
    expect(screen.getByText('Da Alfa')).toBeInTheDocument()
    expect(screen.getByText('Pessoal')).toBeInTheDocument()
  })

  it('listaVaziaMostraMensagem', async () => {
    mockar([])
    renderPainel()
    expect(await screen.findByText('Você não tem tarefas.')).toBeInTheDocument()
  })

  it('criaTarefaSemProjetoPorPadrao', async () => {
    let corpo: unknown = null
    let tarefas: Tarefa[] = []
    server.use(
      http.get('/tarefas/minhas', () => HttpResponse.json(tarefas)),
      http.get('/projetos', () => HttpResponse.json(PROJETOS)),
      http.post('/tarefas', async ({ request }) => {
        corpo = await request.json()
        tarefas = [tarefa({ cardId: 9, titulo: 'Nova', pessoal: true, projetoNome: null })]
        return HttpResponse.json(tarefas[0], { status: 201 })
      }),
    )
    const user = userEvent.setup()
    renderPainel()

    await screen.findByText('Você não tem tarefas.')
    await user.type(screen.getByLabelText('Título da nova tarefa'), 'Nova')
    await user.click(screen.getByRole('button', { name: 'Adicionar' }))

    expect(await screen.findByText('Nova')).toBeInTheDocument()
    expect(corpo).toMatchObject({ titulo: 'Nova', projetoId: null, prazo: null })
    expect(screen.getByLabelText('Título da nova tarefa')).toHaveValue('')
  })

  it('criaTarefaComProjetoEscolhido', async () => {
    let corpo: unknown = null
    server.use(
      http.get('/tarefas/minhas', () => HttpResponse.json([])),
      http.get('/projetos', () => HttpResponse.json(PROJETOS)),
      http.post('/tarefas', async ({ request }) => {
        corpo = await request.json()
        return HttpResponse.json(tarefa({ cardId: 9 }), { status: 201 })
      }),
    )
    const user = userEvent.setup()
    renderPainel()

    await screen.findByText('Você não tem tarefas.')
    await user.type(screen.getByLabelText('Título da nova tarefa'), 'Cap 2')
    const seletor = screen.getByLabelText('Projeto da nova tarefa')
    await within(seletor).findByRole('option', { name: 'Projeto Beta' })
    await user.selectOptions(seletor, 'Projeto Beta')
    await user.type(screen.getByLabelText('Prazo da nova tarefa'), '2026-12-01')
    await user.click(screen.getByRole('button', { name: 'Adicionar' }))

    await vi.waitFor(() => expect(corpo).toMatchObject({ titulo: 'Cap 2', projetoId: 20, prazo: '2026-12-01' }))
  })

  it('tituloEmBrancoNaoEnvia', async () => {
    let chamou = false
    server.use(
      http.get('/tarefas/minhas', () => HttpResponse.json([])),
      http.get('/projetos', () => HttpResponse.json(PROJETOS)),
      http.post('/tarefas', () => {
        chamou = true
        return HttpResponse.json(tarefa({}), { status: 201 })
      }),
    )
    const user = userEvent.setup()
    renderPainel()

    await screen.findByText('Você não tem tarefas.')
    await user.type(screen.getByLabelText('Título da nova tarefa'), '   ')
    await user.click(screen.getByRole('button', { name: 'Adicionar' }))
    // dá tempo de um POST assíncrono (regressão do trim) chegar ao servidor antes de afirmar
    await new Promise((resolve) => setTimeout(resolve, 150))
    expect(chamou).toBe(false)
  })

  it('trocarEstadoChamaPatchEAtualizaALista', async () => {
    let estado: Tarefa['estado'] = 'A_FAZER'
    let corpo: unknown = null
    server.use(
      http.get('/tarefas/minhas', () => HttpResponse.json([tarefa({ cardId: 1, titulo: 'Mover', estado })])),
      http.get('/projetos', () => HttpResponse.json(PROJETOS)),
      http.patch('/tarefas/1/estado', async ({ request }) => {
        corpo = await request.json()
        estado = 'EM_ANDAMENTO'
        return HttpResponse.json(tarefa({ cardId: 1, estado }))
      }),
    )
    const user = userEvent.setup()
    renderPainel()

    await screen.findByText('Mover')
    await user.selectOptions(screen.getByLabelText('Estado de Mover'), 'Em andamento')

    await vi.waitFor(() => expect(corpo).toEqual({ estado: 'EM_ANDAMENTO' }))
    const secao = await screen.findByRole('region', { name: 'Em andamento' })
    expect(await within(secao).findByText('Mover')).toBeInTheDocument()
  })

  it('seletorDeEstadoMostraSoOsEstadosDisponiveis', async () => {
    mockar([tarefa({ cardId: 1, titulo: 'Duas etapas', estadosDisponiveis: ['A_FAZER', 'FEITO'] })])
    renderPainel()

    const seletor = await screen.findByLabelText('Estado de Duas etapas')
    const opcoes = within(seletor).getAllByRole('option').map((o) => o.textContent)
    expect(opcoes).toEqual(['A fazer', 'Feito'])
    expect(seletor).not.toBeDisabled()
  })

  it('seletorSempreIncluiOEstadoAtualMesmoAusenteDosDisponiveis', async () => {
    mockar([tarefa({ cardId: 1, titulo: 'Ausente', estado: 'EM_ANDAMENTO', estadosDisponiveis: ['A_FAZER', 'FEITO'] })])
    renderPainel()

    const seletor = await screen.findByLabelText('Estado de Ausente')
    const opcoes = within(seletor).getAllByRole('option').map((o) => o.textContent)
    expect(opcoes).toEqual(['A fazer', 'Em andamento', 'Feito'])
    expect(seletor).toHaveValue('EM_ANDAMENTO')
  })

  it('seletorComUmaUnicaOpcaoFicaDesabilitado', async () => {
    mockar([tarefa({ cardId: 1, titulo: 'Chamado', estado: 'EM_ANDAMENTO', estadosDisponiveis: ['EM_ANDAMENTO'] })])
    renderPainel()

    const seletor = await screen.findByLabelText('Estado de Chamado')
    expect(within(seletor).getAllByRole('option')).toHaveLength(1)
    expect(seletor).toBeDisabled()
  })

  it('projetoFazendoFeitoBacklogMostraOsTresEstados', async () => {
    mockar([
      tarefa({
        cardId: 1,
        titulo: 'No backlog',
        estado: 'A_FAZER',
        estadosDisponiveis: ['A_FAZER', 'EM_ANDAMENTO', 'FEITO'],
      }),
    ])
    renderPainel()

    const seletor = await screen.findByLabelText('Estado de No backlog')
    const opcoes = within(seletor).getAllByRole('option').map((o) => o.textContent)
    expect(opcoes).toEqual(['A fazer', 'Em andamento', 'Feito'])
    expect(seletor).toHaveValue('A_FAZER')
  })

  it('tarefaSemEstadosDisponiveisDeBackendAntigoMostraSoOEstadoAtual', async () => {
    const semCampo = { ...tarefa({ cardId: 1, titulo: 'Legada', estado: 'EM_ANDAMENTO' }) } as Partial<Tarefa>
    delete semCampo.estadosDisponiveis
    mockar([semCampo as Tarefa])
    renderPainel()

    const seletor = await screen.findByLabelText('Estado de Legada')
    expect(within(seletor).getAllByRole('option').map((o) => o.textContent)).toEqual(['Em andamento'])
    expect(seletor).toBeDisabled()
  })

  it('erroAoTrocarEstadoMostraMensagem', async () => {
    server.use(
      http.get('/tarefas/minhas', () => HttpResponse.json([tarefa({ cardId: 1, titulo: 'Mover' })])),
      http.get('/projetos', () => HttpResponse.json(PROJETOS)),
      http.patch('/tarefas/1/estado', () => new HttpResponse(null, { status: 409 })),
    )
    const user = userEvent.setup()
    renderPainel()

    await screen.findByText('Mover')
    await user.selectOptions(screen.getByLabelText('Estado de Mover'), 'Em andamento')

    expect(await screen.findByRole('alert')).toHaveTextContent(/limite de tarefas em andamento/)
  })

  it('seletorDeEtapaUnicaExplicaComoFinalizar', async () => {
    mockar([tarefa({ cardId: 1, titulo: 'Chamado', estado: 'EM_ANDAMENTO', estadosDisponiveis: ['EM_ANDAMENTO'] })])
    renderPainel()

    const seletor = await screen.findByLabelText('Estado de Chamado')
    expect(seletor).toBeDisabled()
    expect(seletor).toHaveAttribute('title', expect.stringContaining('Use "Concluir"'))
    expect(seletor).toHaveAttribute('title', expect.stringContaining('"Em andamento"'))
  })

  it('concluirAbreCampoEConfirmarSoHabilitaComTexto', async () => {
    mockar([tarefa({ cardId: 1, titulo: 'Chamado' })])
    const user = userEvent.setup()
    renderPainel()

    await screen.findByText('Chamado')
    expect(screen.queryByLabelText('Descrição da conclusão de Chamado')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Concluir' }))
    const campo = screen.getByLabelText('Descrição da conclusão de Chamado')
    const confirmar = screen.getByRole('button', { name: 'Confirmar conclusão' })
    expect(confirmar).toBeDisabled()
    await user.type(campo, '   ')
    expect(confirmar).toBeDisabled()
    await user.type(campo, 'feito')
    expect(confirmar).toBeEnabled()
  })

  it('confirmarConclusaoEnviaDescricaoSemEspacosERecarregaALista', async () => {
    let corpo: unknown = null
    let feito = false
    server.use(
      http.get('/tarefas/minhas', () =>
        HttpResponse.json([
          tarefa({
            cardId: 1,
            titulo: 'Chamado',
            estado: feito ? 'FEITO' : 'EM_ANDAMENTO',
            concluidoEm: feito ? '2026-11-27T10:00:00Z' : null,
          }),
        ]),
      ),
      http.get('/projetos', () => HttpResponse.json(PROJETOS)),
      http.post('/cards/1/cronometro/finalizar', async ({ request }) => {
        corpo = await request.json()
        feito = true
        return HttpResponse.json({})
      }),
    )
    const user = userEvent.setup()
    renderPainel()

    await screen.findByText('Chamado')
    await user.click(screen.getByRole('button', { name: 'Concluir' }))
    await user.type(screen.getByLabelText('Descrição da conclusão de Chamado'), '  Resolvido  ')
    await user.click(screen.getByRole('button', { name: 'Confirmar conclusão' }))

    await vi.waitFor(() => expect(corpo).toEqual({ descricao: 'Resolvido' }))
    const secao = await screen.findByRole('region', { name: 'Feito' })
    await vi.waitFor(() => expect(within(secao).getByText(/^Feito \(1\)/)).toBeInTheDocument())
    expect(screen.queryByLabelText('Descrição da conclusão de Chamado')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Concluir' })).not.toBeInTheDocument()
  })

  it('erroAoConcluirMostraMensagemEMantemOTexto', async () => {
    server.use(
      http.get('/tarefas/minhas', () => HttpResponse.json([tarefa({ cardId: 1, titulo: 'Chamado' })])),
      http.get('/projetos', () => HttpResponse.json(PROJETOS)),
      http.post('/cards/1/cronometro/finalizar', () => new HttpResponse(null, { status: 500 })),
    )
    const user = userEvent.setup()
    renderPainel()

    await screen.findByText('Chamado')
    await user.click(screen.getByRole('button', { name: 'Concluir' }))
    await user.type(screen.getByLabelText('Descrição da conclusão de Chamado'), 'Texto importante')
    await user.click(screen.getByRole('button', { name: 'Confirmar conclusão' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível concluir a tarefa')
    expect(screen.getByLabelText('Descrição da conclusão de Chamado')).toHaveValue('Texto importante')
  })

  it('tarefaFeitaNaoTemConcluirESeletorFicaDesabilitado', async () => {
    mockar([tarefa({ cardId: 1, titulo: 'Entregue', estado: 'FEITO', concluidoEm: '2026-11-27T10:00:00Z' })])
    renderPainel()

    const seletor = await screen.findByLabelText('Estado de Entregue')
    expect(screen.queryByRole('button', { name: 'Concluir' })).not.toBeInTheDocument()
    expect(seletor).toBeDisabled()
    expect(seletor).toHaveAttribute('title', 'Tarefa já finalizada')
  })

  it('cancelarFechaOFormularioSemRequisicao', async () => {
    let chamou = false
    server.use(
      http.get('/tarefas/minhas', () => HttpResponse.json([tarefa({ cardId: 1, titulo: 'Chamado' })])),
      http.get('/projetos', () => HttpResponse.json(PROJETOS)),
      http.post('/cards/1/cronometro/finalizar', () => {
        chamou = true
        return HttpResponse.json({})
      }),
    )
    const user = userEvent.setup()
    renderPainel()

    await screen.findByText('Chamado')
    await user.click(screen.getByRole('button', { name: 'Concluir' }))
    await user.type(screen.getByLabelText('Descrição da conclusão de Chamado'), 'abc')
    await user.click(screen.getByRole('button', { name: 'Cancelar' }))

    expect(screen.queryByLabelText('Descrição da conclusão de Chamado')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Concluir' })).toBeInTheDocument()
    await new Promise((resolve) => setTimeout(resolve, 100))
    expect(chamou).toBe(false)
  })

  it('etapaUnicaMostraDicaVisivelLigadaAoSeletor', async () => {
    mockar([tarefa({ cardId: 1, titulo: 'Chamado', estado: 'EM_ANDAMENTO', estadosDisponiveis: ['EM_ANDAMENTO'] })])
    renderPainel()

    const seletor = await screen.findByLabelText('Estado de Chamado')
    const dica = screen.getByText('Só existe a etapa "Em andamento" neste projeto. Use "Concluir" para finalizar.')
    expect(dica).toBeVisible()
    expect(dica).toHaveClass('tarefa-dica')
    expect(seletor).toHaveAttribute('aria-describedby', dica.id)
    expect(document.querySelector('.sr-only')).toBeNull()
  })

  async function abrirFormulario(user: ReturnType<typeof userEvent.setup>, titulo = 'Chamado') {
    await screen.findByText(titulo)
    await user.click(screen.getByRole('button', { name: 'Concluir' }))
    return screen.getByLabelText(`Descrição da conclusão de ${titulo}`)
  }

  it('conclusao409MostraErroNoFormularioERecarregaALista', async () => {
    let buscas = 0
    server.use(
      http.get('/tarefas/minhas', () => {
        buscas++
        return HttpResponse.json([tarefa({ cardId: 1, titulo: 'Chamado' })])
      }),
      http.get('/projetos', () => HttpResponse.json(PROJETOS)),
      http.post('/cards/1/cronometro/finalizar', () => new HttpResponse(null, { status: 409 })),
    )
    const user = userEvent.setup()
    renderPainel()
    const campo = await abrirFormulario(user)
    await user.type(campo, 'abc')
    await user.click(screen.getByRole('button', { name: 'Confirmar conclusão' }))

    const alerta = await screen.findByRole('alert')
    expect(alerta).toHaveTextContent('Essa tarefa já foi finalizada')
    expect(screen.getByLabelText('Descrição da conclusão de Chamado').closest('form')).toContainElement(alerta)
    expect(screen.getByLabelText('Descrição da conclusão de Chamado')).toHaveAttribute('aria-describedby', alerta.id)
    await vi.waitFor(() => expect(buscas).toBeGreaterThanOrEqual(2))
  })

  it('conclusao404MostraMensagemDeSemAcesso', async () => {
    server.use(
      http.get('/tarefas/minhas', () => HttpResponse.json([tarefa({ cardId: 1, titulo: 'Chamado' })])),
      http.get('/projetos', () => HttpResponse.json(PROJETOS)),
      http.post('/cards/1/cronometro/finalizar', () => new HttpResponse(null, { status: 404 })),
    )
    const user = userEvent.setup()
    renderPainel()
    await user.type(await abrirFormulario(user), 'abc')
    await user.click(screen.getByRole('button', { name: 'Confirmar conclusão' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Você não tem acesso a esta tarefa')
  })

  it('enterEnviaAConclusao', async () => {
    let corpo: unknown = null
    server.use(
      http.get('/tarefas/minhas', () => HttpResponse.json([tarefa({ cardId: 1, titulo: 'Chamado' })])),
      http.get('/projetos', () => HttpResponse.json(PROJETOS)),
      http.post('/cards/1/cronometro/finalizar', async ({ request }) => {
        corpo = await request.json()
        return HttpResponse.json({})
      }),
    )
    const user = userEvent.setup()
    renderPainel()
    await user.type(await abrirFormulario(user), 'pronto{Enter}')
    await vi.waitFor(() => expect(corpo).toEqual({ descricao: 'pronto' }))
  })

  it('escapeCancelaSemRequisicao', async () => {
    let chamou = false
    server.use(
      http.get('/tarefas/minhas', () => HttpResponse.json([tarefa({ cardId: 1, titulo: 'Chamado' })])),
      http.get('/projetos', () => HttpResponse.json(PROJETOS)),
      http.post('/cards/1/cronometro/finalizar', () => {
        chamou = true
        return HttpResponse.json({})
      }),
    )
    const user = userEvent.setup()
    renderPainel()
    await user.type(await abrirFormulario(user), 'abc{Escape}')
    expect(screen.queryByLabelText('Descrição da conclusão de Chamado')).not.toBeInTheDocument()
    await new Promise((resolve) => setTimeout(resolve, 100))
    expect(chamou).toBe(false)
  })

  it('enquantoPendenteDesabilitaCancelarEOutrosConcluir', async () => {
    server.use(
      http.get('/tarefas/minhas', () =>
        HttpResponse.json([tarefa({ cardId: 1, titulo: 'Chamado' }), tarefa({ cardId: 2, titulo: 'Outra' })]),
      ),
      http.get('/projetos', () => HttpResponse.json(PROJETOS)),
      http.post('/cards/1/cronometro/finalizar', async () => {
        await new Promise((resolve) => setTimeout(resolve, 300))
        return HttpResponse.json({})
      }),
    )
    const user = userEvent.setup()
    renderPainel()
    await screen.findByText('Chamado')
    await user.click(screen.getAllByRole('button', { name: 'Concluir' })[0])
    await user.type(screen.getByLabelText('Descrição da conclusão de Chamado'), 'abc')
    await user.click(screen.getByRole('button', { name: 'Confirmar conclusão' }))

    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Concluir' })).toBeDisabled()
    await user.type(screen.getByLabelText('Descrição da conclusão de Chamado'), '{Escape}')
    expect(screen.getByLabelText('Descrição da conclusão de Chamado')).toBeInTheDocument()
    await vi.waitFor(() => expect(screen.queryByLabelText('Descrição da conclusão de Chamado')).not.toBeInTheDocument())
  })

  it('clicarNoTituloChamaAoAbrirTarefa', async () => {
    mockar([tarefa({ cardId: 7, titulo: 'Abrir', projetoId: 10 })])
    const aoAbrir = vi.fn()
    const user = userEvent.setup()
    renderPainel(aoAbrir)

    await user.click(await screen.findByRole('button', { name: 'Abrir' }))
    expect(aoAbrir).toHaveBeenCalledWith(10, 7)
  })
})
