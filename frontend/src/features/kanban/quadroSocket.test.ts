import { describe, expect, it } from 'vitest'
import { construirUrlWebSocketQuadro } from './quadroSocket'

describe('construirUrlWebSocketQuadro', () => {
  it('troca http por ws e monta o path com o id do quadro e o token', () => {
    const url = construirUrlWebSocketQuadro(5, 'token-abc', 'http://localhost:5173')

    expect(url).toBe('ws://localhost:5173/ws/quadro/5?token=token-abc')
  })

  it('troca https por wss (produção atrás de TLS)', () => {
    const url = construirUrlWebSocketQuadro(5, 'token-abc', 'https://app.escritor.io')

    expect(url).toBe('wss://app.escritor.io/ws/quadro/5?token=token-abc')
  })

  it('codifica o token na query string', () => {
    const url = construirUrlWebSocketQuadro(1, 'a b+c', 'http://localhost:5173')

    expect(url).toBe('ws://localhost:5173/ws/quadro/1?token=a%20b%2Bc')
  })
})
