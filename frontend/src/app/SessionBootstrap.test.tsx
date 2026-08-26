import { render, screen } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { useAuthStore } from '../features/auth/authStore'
import { SessionBootstrap } from './SessionBootstrap'

const server = setupServer()

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

const ESTADO_INICIAL = useAuthStore.getState()

beforeEach(() => {
  useAuthStore.setState(ESTADO_INICIAL, true)
})

describe('SessionBootstrap', () => {
  it('restaura a sessão quando o refresh cookie ainda é válido', async () => {
    server.use(
      http.post('/auth/refresh', () =>
        HttpResponse.json({
          accessToken:
            'eyJhbGciOiJIUzUxMiJ9.eyJzdWIiOiIxIiwicGFwZWwiOiJBRE1JTiIsImV4cCI6MTk5OTk5OTk5OX0.assinatura',
        }),
      ),
    )

    render(
      <SessionBootstrap>
        <p>Conteúdo</p>
      </SessionBootstrap>,
    )

    expect(await screen.findByText('Conteúdo')).toBeInTheDocument()
    expect(useAuthStore.getState().autenticado).toBe(true)
    expect(useAuthStore.getState().papel).toBe('ADMIN')
  })

  it('segue sem sessão quando não há refresh cookie válido', async () => {
    server.use(http.post('/auth/refresh', () => new HttpResponse(null, { status: 401 })))

    render(
      <SessionBootstrap>
        <p>Conteúdo</p>
      </SessionBootstrap>,
    )

    expect(await screen.findByText('Conteúdo')).toBeInTheDocument()
    expect(useAuthStore.getState().autenticado).toBe(false)
  })
})
