import { beforeEach, describe, expect, it } from 'vitest'
import { useAuthStore } from './authStore'

const ESTADO_INICIAL = useAuthStore.getState()

beforeEach(() => {
  useAuthStore.setState(ESTADO_INICIAL, true)
})

describe('useAuthStore', () => {
  it('começa sem sessão', () => {
    const estado = useAuthStore.getState()

    expect(estado.autenticado).toBe(false)
    expect(estado.accessToken).toBeNull()
    expect(estado.papel).toBeNull()
  })

  it('definirSessao autentica e guarda token e papel', () => {
    useAuthStore.getState().definirSessao('token-fake', 'GESTOR')

    const estado = useAuthStore.getState()
    expect(estado.autenticado).toBe(true)
    expect(estado.accessToken).toBe('token-fake')
    expect(estado.papel).toBe('GESTOR')
  })

  it('encerrarSessao limpa o estado', () => {
    useAuthStore.getState().definirSessao('token-fake', 'ADMIN')

    useAuthStore.getState().encerrarSessao()

    const estado = useAuthStore.getState()
    expect(estado.autenticado).toBe(false)
    expect(estado.accessToken).toBeNull()
    expect(estado.papel).toBeNull()
  })
})
