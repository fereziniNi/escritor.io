import { renovarSessao } from '../../features/auth/api'
import { useAuthStore } from '../../features/auth/authStore'
import { decodeJwt } from '../../features/auth/jwt'

function comAuthorization(init: RequestInit): RequestInit {
  const accessToken = useAuthStore.getState().accessToken
  if (!accessToken) {
    return init
  }
  const headers = new Headers(init.headers)
  headers.set('Authorization', `Bearer ${accessToken}`)
  return { ...init, headers }
}

/**
 * fetch autenticado: anexa o access token da sessão e, se a resposta vier 401
 * (token expirado), tenta renovar via /auth/refresh e repete a requisição uma
 * única vez antes de desistir e encerrar a sessão.
 */
export async function apiFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const resposta = await fetch(input, comAuthorization(init))

  if (resposta.status !== 401) {
    return resposta
  }

  const tokens = await renovarSessao()
  if (!tokens) {
    useAuthStore.getState().encerrarSessao()
    return resposta
  }

  const claims = decodeJwt(tokens.accessToken)
  useAuthStore.getState().definirSessao(tokens.accessToken, claims.papel)

  return fetch(input, comAuthorization(init))
}
