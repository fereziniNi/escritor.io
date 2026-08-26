import { describe, expect, it } from 'vitest'
import { decodeJwt } from './jwt'

function base64UrlEncode(json: object): string {
  const base64 = btoa(JSON.stringify(json))
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function tokenFalsoCom(payload: object): string {
  const header = base64UrlEncode({ alg: 'HS512' })
  const corpo = base64UrlEncode(payload)
  return `${header}.${corpo}.assinatura-nao-importa-aqui`
}

describe('decodeJwt', () => {
  it('extrai as claims do payload', () => {
    const token = tokenFalsoCom({ sub: '42', papel: 'GESTOR', exp: 1999999999 })

    const claims = decodeJwt(token)

    expect(claims.sub).toBe('42')
    expect(claims.papel).toBe('GESTOR')
    expect(claims.exp).toBe(1999999999)
  })

  it('lida com payload contendo caracteres que exigem padding base64url', () => {
    const token = tokenFalsoCom({ sub: '1', papel: 'ADMIN', exp: 1 })

    expect(() => decodeJwt(token)).not.toThrow()
  })
})
