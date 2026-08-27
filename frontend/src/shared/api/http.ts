import { renovarSessao } from '../../features/auth/api'
import { useAuthStore } from '../../features/auth/authStore'
import type { TokensResponse } from '../../features/auth/types'

function comAuthorization(init: RequestInit): RequestInit {
  const accessToken = useAuthStore.getState().accessToken
  if (!accessToken) {
    return init
  }
  const headers = new Headers(init.headers)
  headers.set('Authorization', `Bearer ${accessToken}`)
  return { ...init, headers }
}

let renovacaoEmAndamento: Promise<TokensResponse | null> | null = null

/**
 * Garante que, mesmo com vários apiFetch levando 401 ao mesmo tempo, só uma chamada real a
 * /auth/refresh sai - o refresh token é de uso único no backend, então uma segunda chamada
 * concorrente seria tratada como reuso e derrubaria a sessão inteira (todos os refresh tokens
 * ativos do usuário), mesmo sem nenhum ataque envolvido.
 */
function renovarSessaoUnica(): Promise<TokensResponse | null> {
  if (!renovacaoEmAndamento) {
    renovacaoEmAndamento = renovarSessao().finally(() => {
      renovacaoEmAndamento = null
    })
  }
  return renovacaoEmAndamento
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

  const tokens = await renovarSessaoUnica()
  if (!tokens) {
    useAuthStore.getState().encerrarSessao()
    return resposta
  }

  useAuthStore.getState().autenticarComTokens(tokens)

  return fetch(input, comAuthorization(init))
}
