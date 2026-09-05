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
  it('marca os dias já configurados com o horário salvo', async () => {
    server.use(
      http.get('/escala/semanal', () =>
        HttpResponse.json([{ id: 1, diaSemana: 'MONDAY', horaInicio: '09:00:00', horaFim: '18:00:00' }]),
      ),
    )

    renderForm()

    const checkboxSegunda = (await screen.findByLabelText('Segunda-feira')) as HTMLInputElement
    expect(checkboxSegunda.checked).toBe(true)
    expect((screen.getByLabelText('Início em Segunda-feira') as HTMLInputElement).value).toBe('09:00')

    const checkboxTerca = screen.getByLabelText('Terça-feira') as HTMLInputElement
    expect(checkboxTerca.checked).toBe(false)
    expect((screen.getByLabelText('Início em Terça-feira') as HTMLInputElement).disabled).toBe(true)
  })

  it('marca um novo dia, ajusta o horário e salva o padrão semanal inteiro', async () => {
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

    await user.click(await screen.findByLabelText('Sexta-feira'))
    const inicio = screen.getByLabelText('Início em Sexta-feira')
    await user.clear(inicio)
    await user.type(inicio, '08:00')
    const fim = screen.getByLabelText('Fim em Sexta-feira')
    await user.clear(fim)
    await user.type(fim, '12:00')

    await user.click(screen.getByRole('button', { name: /salvar padrão semanal/i }))

    expect(await screen.findByText(/padrão semanal salvo/i)).toBeInTheDocument()
    expect(corpoEnviado).toEqual([{ diaSemana: 'FRIDAY', horaInicio: '08:00:00', horaFim: '12:00:00' }])
  })

  it('mostra erro quando salvar falha', async () => {
    server.use(http.get('/escala/semanal', () => HttpResponse.json([])))
    server.use(http.put('/escala/semanal', () => new HttpResponse(null, { status: 500 })))
    const user = userEvent.setup()
    renderForm()

    await user.click(await screen.findByLabelText('Segunda-feira'))
    await user.click(screen.getByRole('button', { name: /salvar padrão semanal/i }))

    expect(await screen.findByText(/não foi possível salvar o padrão semanal/i)).toBeInTheDocument()
  })
})
