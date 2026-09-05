import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { PadraoSemanalForm } from './PadraoSemanalForm'

const server = setupServer()

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

function renderForm() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <PadraoSemanalForm />
    </QueryClientProvider>,
  )
}

describe('PadraoSemanalForm', () => {
  it('mostra um resumo dos dias configurados sem abrir o modal', async () => {
    server.use(
      http.get('/escala/semanal', () =>
        HttpResponse.json([{ id: 1, diaSemana: 'MONDAY', horaInicio: '09:00:00', horaFim: '18:00:00' }]),
      ),
    )

    renderForm()

    expect(await screen.findByText('Segunda')).toBeInTheDocument()
    expect(screen.queryByLabelText('Segunda-feira')).not.toBeInTheDocument()
  })

  it('mostra "Nenhum dia configurado ainda" quando o padrão está vazio', async () => {
    server.use(http.get('/escala/semanal', () => HttpResponse.json([])))

    renderForm()

    expect(await screen.findByText(/nenhum dia configurado ainda/i)).toBeInTheDocument()
  })

  it('abre o modal com os dias já configurados marcados', async () => {
    server.use(
      http.get('/escala/semanal', () =>
        HttpResponse.json([{ id: 1, diaSemana: 'MONDAY', horaInicio: '09:00:00', horaFim: '18:00:00' }]),
      ),
    )
    const user = userEvent.setup()
    renderForm()

    await screen.findByText('Segunda')
    await user.click(screen.getByRole('button', { name: /configurar padrão semanal/i }))

    const checkboxSegunda = screen.getByLabelText('Segunda-feira') as HTMLInputElement
    expect(checkboxSegunda.checked).toBe(true)
    expect((screen.getByLabelText('Início em Segunda-feira') as HTMLInputElement).value).toBe('09:00')

    const checkboxTerca = screen.getByLabelText('Terça-feira') as HTMLInputElement
    expect(checkboxTerca.checked).toBe(false)
    expect((screen.getByLabelText('Início em Terça-feira') as HTMLInputElement).disabled).toBe(true)
  })

  it('marca um novo dia, ajusta o horário, salva, e o modal fecha sozinho', async () => {
    server.use(http.get('/escala/semanal', () => HttpResponse.json([])))
    let corpoEnviado: unknown = null
    server.use(
      http.put('/escala/semanal', async ({ request }) => {
        corpoEnviado = await request.json()
        return HttpResponse.json([{ id: 1, diaSemana: 'FRIDAY', horaInicio: '08:00:00', horaFim: '12:00:00' }])
      }),
    )
    const user = userEvent.setup()
    renderForm()

    await screen.findByText(/nenhum dia configurado ainda/i)
    await user.click(screen.getByRole('button', { name: /configurar padrão semanal/i }))
    await user.click(screen.getByLabelText('Sexta-feira'))
    const inicio = screen.getByLabelText('Início em Sexta-feira')
    await user.clear(inicio)
    await user.type(inicio, '08:00')
    const fim = screen.getByLabelText('Fim em Sexta-feira')
    await user.clear(fim)
    await user.type(fim, '12:00')

    await user.click(screen.getByRole('button', { name: /salvar padrão semanal/i }))

    expect(corpoEnviado).toEqual([{ diaSemana: 'FRIDAY', horaInicio: '08:00:00', horaFim: '12:00:00' }])
    // o modal some sozinho depois de salvar (pedido do usuário) - e o resumo por fora já reflete
    // o que acabou de ser salvo, sem precisar recarregar a página
    expect(await screen.findByText('Sexta')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('mostra erro quando salvar falha, sem fechar o modal', async () => {
    server.use(http.get('/escala/semanal', () => HttpResponse.json([])))
    server.use(http.put('/escala/semanal', () => new HttpResponse(null, { status: 500 })))
    const user = userEvent.setup()
    renderForm()

    await screen.findByText(/nenhum dia configurado ainda/i)
    await user.click(screen.getByRole('button', { name: /configurar padrão semanal/i }))
    await user.click(screen.getByLabelText('Segunda-feira'))
    await user.click(screen.getByRole('button', { name: /salvar padrão semanal/i }))

    expect(await screen.findByText(/não foi possível salvar o padrão semanal/i)).toBeInTheDocument()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('Cancelar descarta as alterações não salvas e fecha o modal', async () => {
    server.use(
      http.get('/escala/semanal', () =>
        HttpResponse.json([{ id: 1, diaSemana: 'MONDAY', horaInicio: '09:00:00', horaFim: '18:00:00' }]),
      ),
    )
    const user = userEvent.setup()
    renderForm()

    await screen.findByText('Segunda')
    await user.click(screen.getByRole('button', { name: /configurar padrão semanal/i }))
    await user.click(screen.getByLabelText('Sexta-feira')) // marca um dia extra sem salvar
    await user.click(screen.getByRole('button', { name: /^cancelar$/i }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    // reabre e confirma que a marcação extra não sobreviveu
    await user.click(screen.getByRole('button', { name: /configurar padrão semanal/i }))
    expect((screen.getByLabelText('Sexta-feira') as HTMLInputElement).checked).toBe(false)
  })
})
