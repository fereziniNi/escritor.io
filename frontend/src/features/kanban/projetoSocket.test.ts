import { describe, expect, it } from 'vitest'
import { construirUrlWebSocketProjeto } from './projetoSocket'

describe('construirUrlWebSocketProjeto', () => {
  it('troca http por ws e monta o path com o id do projeto e o token', () => {
    const url = construirUrlWebSocketProjeto(5, 'token-abc', 'http://localhost:5173')

    expect(url).toBe('ws://localhost:5173/ws/projeto/5?token=token-abc')
  })

  it('troca https por wss (produção atrás de TLS)', () => {
    const url = construirUrlWebSocketProjeto(5, 'token-abc', 'https://app.escritor.io')

    expect(url).toBe('wss://app.escritor.io/ws/projeto/5?token=token-abc')
  })

  it('codifica o token na query string', () => {
    const url = construirUrlWebSocketProjeto(1, 'a b+c', 'http://localhost:5173')

    expect(url).toBe('ws://localhost:5173/ws/projeto/1?token=a%20b%2Bc')
  })
})
