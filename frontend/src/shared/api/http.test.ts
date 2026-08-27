import { HttpResponse, http } from 'msw'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { useAuthStore } from '../../features/auth/authStore'
import { apiFetch } from './http'

const server = setupServer()

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

const ESTADO_INICIAL = useAuthStore.getState()

beforeEach(() => {
  useAuthStore.setState(ESTADO_INICIAL, true)
})

describe('apiFetch', () => {
  it('anexa o access token no header Authorization quando há sessão', async () => {
    useAuthStore.getState().definirSessao('token-atual', 'ADMIN')
    let cabecalhoRecebido: string | null = null
    server.use(
      http.get('/recurso', ({ request }) => {
        cabecalhoRecebido = request.headers.get('authorization')
        return HttpResponse.json({ ok: true })
      }),
    )

    await apiFetch('/recurso')

    expect(cabecalhoRecebido).toBe('Bearer token-atual')
  })

  it('não envia Authorization quando não há sessão', async () => {
    let cabecalhoRecebido: string | null = 'nao-deveria-mudar';
    server.use(
      http.get('/recurso', ({ request }) => {
        cabecalhoRecebido = request.headers.get('authorization')
        return HttpResponse.json({ ok: true })
      }),
    )

    await apiFetch('/recurso')

    expect(cabecalhoRecebido).toBeNull()
  })

  it('em 401, tenta renovar a sessão e repete a requisição uma vez', async () => {
    useAuthStore.getState().definirSessao('token-expirado', 'ADMIN')
    let tentativas = 0
    server.use(
      http.get('/recurso', ({ request }) => {
        tentativas++
        const auth = request.headers.get('authorization')
        if (auth === 'Bearer token-expirado') {
          return new HttpResponse(null, { status: 401 })
        }
        return HttpResponse.json({ auth })
      }),
      http.post('/auth/refresh', () =>
        HttpResponse.json({
          accessToken:
            'eyJhbGciOiJIUzUxMiJ9.eyJzdWIiOiIxIiwicGFwZWwiOiJBRE1JTiIsImV4cCI6MTk5OTk5OTk5OX0.assinatura',
        }),
      ),
    )

    const resposta = await apiFetch('/recurso')

    expect(tentativas).toBe(2)
    expect(resposta.status).toBe(200)
    expect(useAuthStore.getState().accessToken).toBe(
      'eyJhbGciOiJIUzUxMiJ9.eyJzdWIiOiIxIiwicGFwZWwiOiJBRE1JTiIsImV4cCI6MTk5OTk5OTk5OX0.assinatura',
    )
  })

  it('em 401 sem conseguir renovar, encerra a sessão e devolve a resposta 401 original', async () => {
    useAuthStore.getState().definirSessao('token-expirado', 'ADMIN')
    server.use(
      http.get('/recurso', () => new HttpResponse(null, { status: 401 })),
      http.post('/auth/refresh', () => new HttpResponse(null, { status: 401 })),
    )

    const resposta = await apiFetch('/recurso')

    expect(resposta.status).toBe(401)
    expect(useAuthStore.getState().autenticado).toBe(false)
  })

  it('duas chamadas simultâneas em 401 disparam só uma renovação de sessão', async () => {
    useAuthStore.getState().definirSessao('token-expirado', 'ADMIN')
    let chamadasRefresh = 0
    server.use(
      http.get('/recurso-a', () => new HttpResponse(null, { status: 401 })),
      http.get('/recurso-b', () => new HttpResponse(null, { status: 401 })),
      http.post('/auth/refresh', async () => {
        chamadasRefresh++
        await new Promise((resolve) => setTimeout(resolve, 20))
        return HttpResponse.json({
          accessToken:
            'eyJhbGciOiJIUzUxMiJ9.eyJzdWIiOiIxIiwicGFwZWwiOiJBRE1JTiIsImV4cCI6MTk5OTk5OTk5OX0.assinatura',
        })
      }),
    )

    await Promise.all([apiFetch('/recurso-a'), apiFetch('/recurso-b')])

    expect(chamadasRefresh).toBe(1)
  })
})
