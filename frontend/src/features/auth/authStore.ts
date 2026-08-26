import { create } from 'zustand'
import type { Papel } from './types'

interface AuthState {
  accessToken: string | null
  papel: Papel | null
  autenticado: boolean
  definirSessao: (accessToken: string, papel: Papel) => void
  encerrarSessao: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  papel: null,
  autenticado: false,
  definirSessao: (accessToken, papel) => set({ accessToken, papel, autenticado: true }),
  encerrarSessao: () => set({ accessToken: null, papel: null, autenticado: false }),
}))
