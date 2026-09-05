import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { formatarDataBr } from '../../shared/formatarData'
import { CalendarioExcecoes } from './CalendarioExcecoes'
import { construirGradeDoMes } from './construirGradeDoMes'

const server = setupServer()

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

// Sem fake timers de propósito: `findBy`/`waitFor` do testing-library dependem de timers reais
// (setTimeout) pra fazer polling - com `vi.useFakeTimers()` ativo o polling nunca avança sozinho e
// todo `findBy` trava até o timeout do teste. Em vez de congelar "hoje", cada teste calcula o
// mês/dia esperado a partir da data real (`new Date()`), a mesma que o componente usa por baixo.
const hoje = new Date()
const ANO_ATUAL = hoje.getFullYear()
const MES_ATUAL = hoje.getMonth() + 1 // 1-12
const NOMES_MESES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
]
const ROTULO_MES_ATUAL = `${NOMES_MESES[MES_ATUAL - 1]} de ${ANO_ATUAL}`

const diasDoMesAtual = construirGradeDoMes(ANO_ATUAL, MES_ATUAL).filter((dia) => dia.noMesAtual)
const PRIMEIRO_DIA_DO_MES = diasDoMesAtual[0].data
const SEGUNDO_DIA_DO_MES = diasDoMesAtual[1].data

function renderCalendario() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <CalendarioExcecoes />
    </QueryClientProvider>,
  )
}

describe('CalendarioExcecoes', () => {
  it('mostra o mês/ano atual e o horário efetivo de um dia trabalhado', async () => {
    server.use(
      http.get('/escala/efetiva', () =>
        HttpResponse.json([{ data: PRIMEIRO_DIA_DO_MES, trabalha: true, horaInicio: '09:00:00', horaFim: '18:00:00' }]),
      ),
      http.get('/escala/excecoes', () => HttpResponse.json([])),
    )

    renderCalendario()

    expect(await screen.findByText(ROTULO_MES_ATUAL)).toBeInTheDocument()
    expect(await screen.findByText('09:00–18:00')).toBeInTheDocument()
  })

  it('clicar num dia do mês abre o formulário e salva uma exceção pontual', async () => {
    server.use(
      http.get('/escala/efetiva', () =>
        HttpResponse.json([{ data: PRIMEIRO_DIA_DO_MES, trabalha: true, horaInicio: '09:00:00', horaFim: '18:00:00' }]),
      ),
      http.get('/escala/excecoes', () => HttpResponse.json([])),
    )
    let corpoEnviado: unknown = null
    server.use(
      http.post('/escala/excecoes', async ({ request }) => {
        corpoEnviado = await request.json()
        return HttpResponse.json(
          { id: 9, data: PRIMEIRO_DIA_DO_MES, trabalha: false, horaInicio: null, horaFim: null, observacao: 'Folga' },
          { status: 201 },
        )
      }),
    )
    const user = userEvent.setup()
    renderCalendario()

    await screen.findByText('09:00–18:00')
    await user.click(screen.getByRole('button', { name: formatarDataBr(PRIMEIRO_DIA_DO_MES) }))
    await screen.findByText(formatarDataBr(PRIMEIRO_DIA_DO_MES))

    // desmarca "trabalho nesse dia" - vira uma folga pontual
    await user.click(screen.getByLabelText(/trabalho nesse dia/i))
    await user.type(screen.getByLabelText(/observação/i), 'Folga')
    await user.click(screen.getByRole('button', { name: /salvar/i }))

    expect(corpoEnviado).toEqual({
      data: PRIMEIRO_DIA_DO_MES,
      trabalha: false,
      horaInicio: null,
      horaFim: null,
      observacao: 'Folga',
    })
  })

  it('mostra "Remover exceção" só quando já existe uma exceção salva pra data', async () => {
    server.use(
      http.get('/escala/efetiva', () =>
        HttpResponse.json([{ data: SEGUNDO_DIA_DO_MES, trabalha: false, horaInicio: null, horaFim: null }]),
      ),
      http.get('/escala/excecoes', () =>
        HttpResponse.json([
          { id: 3, data: SEGUNDO_DIA_DO_MES, trabalha: false, horaInicio: null, horaFim: null, observacao: null },
        ]),
      ),
    )
    const user = userEvent.setup()
    renderCalendario()

    const botaoDoDia = await screen.findByRole('button', { name: formatarDataBr(SEGUNDO_DIA_DO_MES) })
    await user.click(botaoDoDia)

    expect(await screen.findByRole('button', { name: /remover exceção/i })).toBeInTheDocument()
  })

  it('não deixa clicar em dias de fora do mês atual (preenchimento da grade)', async () => {
    server.use(http.get('/escala/efetiva', () => HttpResponse.json([])), http.get('/escala/excecoes', () => HttpResponse.json([])))

    renderCalendario()

    await screen.findByText(ROTULO_MES_ATUAL)
    const grade = construirGradeDoMes(ANO_ATUAL, MES_ATUAL)
    const primeiroDiaForaDoMes = grade.find((dia) => !dia.noMesAtual)
    if (!primeiroDiaForaDoMes) {
      // mês raro sem nenhum preenchimento (grade já fecha em semanas exatas) - nada a verificar
      return
    }
    const botao = await screen.findByRole('button', { name: formatarDataBr(primeiroDiaForaDoMes.data) })
    expect(botao).toBeDisabled()
  })

  it('navega pro mês seguinte e volta', async () => {
    server.use(http.get('/escala/efetiva', () => HttpResponse.json([])), http.get('/escala/excecoes', () => HttpResponse.json([])))
    const user = userEvent.setup()
    renderCalendario()

    await screen.findByText(ROTULO_MES_ATUAL)
    await user.click(screen.getByLabelText(/próximo mês/i))
    const mesSeguinteIndex = MES_ATUAL === 12 ? 0 : MES_ATUAL
    const anoDoMesSeguinte = MES_ATUAL === 12 ? ANO_ATUAL + 1 : ANO_ATUAL
    expect(await screen.findByText(`${NOMES_MESES[mesSeguinteIndex]} de ${anoDoMesSeguinte}`)).toBeInTheDocument()

    await user.click(screen.getByLabelText(/mês anterior/i))
    expect(await screen.findByText(ROTULO_MES_ATUAL)).toBeInTheDocument()
  })
})
