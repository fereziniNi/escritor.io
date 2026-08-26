import type { Papel } from './types'

export interface JwtClaims {
  sub: string
  papel: Papel
  exp: number
}

export function decodeJwt(token: string): JwtClaims {
  const payload = token.split('.')[1]
  const base64 = payload.replace(/-/g, '+').replace(/_/g, '/')
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=')
  return JSON.parse(atob(padded)) as JwtClaims
}
