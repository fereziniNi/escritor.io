import { create } from 'zustand'
import { decodeJwt } from './jwt'
import type { Papel, TokensResponse } from './types'

interface AuthState {
  accessToken: string | null
  papel: Papel | null
  autenticado: boolean
  definirSessao: (accessToken: string, papel: Papel) => void
  autenticarComTokens: (tokens: TokensResponse) => void
  encerrarSessao: () => void
}

export const useAuthStore = create<AuthState>((set, get) => ({
  accessToken: null,
  papel: null,
  autenticado: false,
  definirSessao: (accessToken, papel) => set({ accessToken, papel, autenticado: true }),
  autenticarComTokens: (tokens) => {
    const claims = decodeJwt(tokens.accessToken)
    get().definirSessao(tokens.accessToken, claims.papel)
  },
  encerrarSessao: () => set({ accessToken: null, papel: null, autenticado: false }),
}))
