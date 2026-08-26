import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { HealthStatus } from './HealthStatus'

const server = setupServer()

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

function renderHealthStatus() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <HealthStatus />
    </QueryClientProvider>,
  )
}

describe('HealthStatus', () => {
  it('shows a loading state before the health check resolves', () => {
    server.use(http.get('/health', () => HttpResponse.json({ status: 'UP' })))

    renderHealthStatus()

    expect(screen.getByText(/verificando/i)).toBeInTheDocument()
  })

  it('renders the backend status once the health check resolves', async () => {
    server.use(http.get('/health', () => HttpResponse.json({ status: 'UP' })))

    renderHealthStatus()

    expect(await screen.findByText(/UP/)).toBeInTheDocument()
  })

  it('renders an error message when the health check fails', async () => {
    server.use(http.get('/health', () => HttpResponse.error()))

    renderHealthStatus()

    expect(await screen.findByText(/indisponível/i)).toBeInTheDocument()
  })
})
