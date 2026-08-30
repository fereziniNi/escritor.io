import { describe, expect, it } from 'vitest'
import { construirUrlWebSocketPresenca } from './presencaSocket'

describe('construirUrlWebSocketPresenca', () => {
  it('troca http por ws e monta o path com o token', () => {
    const url = construirUrlWebSocketPresenca('token-abc', 'http://localhost:5173')

    expect(url).toBe('ws://localhost:5173/ws/presenca?token=token-abc')
  })

  it('troca https por wss (produção atrás de TLS)', () => {
    const url = construirUrlWebSocketPresenca('token-abc', 'https://app.escritor.io')

    expect(url).toBe('wss://app.escritor.io/ws/presenca?token=token-abc')
  })

  it('codifica o token na query string', () => {
    const url = construirUrlWebSocketPresenca('a b+c', 'http://localhost:5173')

    expect(url).toBe('ws://localhost:5173/ws/presenca?token=a%20b%2Bc')
  })
})
