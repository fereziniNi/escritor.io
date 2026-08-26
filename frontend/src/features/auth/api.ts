import type { TokensResponse } from './types'

export async function solicitarCodigo(email: string): Promise<void> {
  const response = await fetch('/auth/codigo', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  })

  if (!response.ok) {
    throw new Error('Não foi possível solicitar o código')
  }
}

export async function verificarCodigo(email: string, codigo: string): Promise<TokensResponse> {
  const response = await fetch('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, codigo }),
  })

  if (!response.ok) {
    throw new Error('Código inválido')
  }

  return response.json()
}

export async function renovarSessao(): Promise<TokensResponse | null> {
  const response = await fetch('/auth/refresh', { method: 'POST' })

  if (!response.ok) {
    return null
  }

  return response.json()
}
