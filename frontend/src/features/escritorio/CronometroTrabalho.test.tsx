import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { CronometroTrabalho } from './CronometroTrabalho'

const server = setupServer()

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

function renderComponente() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <CronometroTrabalho />
    </QueryClientProvider>,
  )
  return queryClient
}

describe('CronometroTrabalho', () => {
  it('mostra 00:00:00 quando ninguém iniciou o trabalho hoje', async () => {
    server.use(
      http.get('/ponto/estado-atual', () =>
        HttpResponse.json({ ultimoTipo: null, ultimoMomento: null, segundosTrabalhadosAteAgora: 0, proximasOpcoes: ['ENTRADA'] }),
      ),
    )

    renderComponente()

    expect(await screen.findByRole('timer')).toHaveTextContent('00:00:00')
  })

  it('mostra o total formatado (HH:MM:SS) parado durante uma pausa, sem ficar contando', async () => {
    server.use(
      http.get('/ponto/estado-atual', () =>
        HttpResponse.json({
          ultimoTipo: 'PAUSA_INICIO',
          ultimoMomento: '2026-01-15T09:00:00Z',
          segundosTrabalhadosAteAgora: 3725, // 1h02m05s
          proximasOpcoes: ['PAUSA_FIM', 'SAIDA'],
        }),
      ),
    )

    const queryClient = renderComponente()

    expect(await screen.findByRole('timer')).toHaveTextContent('01:02:05')
    // congelado: nem uma nova resolução da query muda o texto, só uma marcação de verdade mudaria
    await waitFor(() => expect(queryClient.getQueryState(['ponto', 'estado-atual'])?.status).toBe('success'))
    expect(screen.getByRole('timer')).toHaveTextContent('01:02:05')
  })

  it('mostra o total do dia parado depois de encerrar o trabalho (SAIDA), com horas de dois dígitos', async () => {
    server.use(
      http.get('/ponto/estado-atual', () =>
        HttpResponse.json({
          ultimoTipo: 'SAIDA',
          ultimoMomento: '2026-01-15T19:00:00Z',
          segundosTrabalhadosAteAgora: 36000, // 10h00m00s
          proximasOpcoes: ['ENTRADA'],
        }),
      ),
    )

    renderComponente()

    expect(await screen.findByRole('timer')).toHaveTextContent('10:00:00')
  })
})
