import { describe, expect, it } from 'vitest'
import { calcularParesProximos, usuariosProximosDeAlguem } from './proximidade'
import { PERSONAGEM_PADRAO } from '../avatar/personagens'
import type { EstadoPresencaUsuario, StatusAvatar } from '../types'

function usuario(usuarioId: number, x: number, y: number, status: StatusAvatar = 'DISPONIVEL'): EstadoPresencaUsuario {
  return { usuarioId, nome: `Usuário ${usuarioId}`, x, y, status, personagem: PERSONAGEM_PADRAO }
}

describe('calcularParesProximos', () => {
  it('encontra um par dentro do raio', () => {
    const pares = calcularParesProximos([usuario(1, 5, 5), usuario(2, 6, 5)], 2)
    expect(pares).toEqual([{ usuarioIdA: 1, usuarioIdB: 2, distanciaTiles: 1 }])
  })

  it('não inclui pares fora do raio', () => {
    const pares = calcularParesProximos([usuario(1, 0, 0), usuario(2, 10, 10)], 2)
    expect(pares).toEqual([])
  })

  it('usa distância euclidiana (inclui diagonal), não Manhattan', () => {
    // (0,0) -> (2,2): distância euclidiana ≈ 2.83, Manhattan seria 4
    const pares = calcularParesProximos([usuario(1, 0, 0), usuario(2, 2, 2)], 3)
    expect(pares).toHaveLength(1)
    expect(pares[0].distanciaTiles).toBeCloseTo(Math.sqrt(8), 5)
  })

  it('considera todos os pares quando há mais de 2 usuários', () => {
    const usuarios = [usuario(1, 0, 0), usuario(2, 1, 0), usuario(3, 20, 20)]
    const pares = calcularParesProximos(usuarios, 2)
    expect(pares).toEqual([{ usuarioIdA: 1, usuarioIdB: 2, distanciaTiles: 1 }])
  })

  it('não quebra com 0 ou 1 usuário', () => {
    expect(calcularParesProximos([], 2)).toEqual([])
    expect(calcularParesProximos([usuario(1, 0, 0)], 2)).toEqual([])
  })

  it('ignora quem está OFFLINE - avatar estacionado em Fora do trabalho não conta como "perto"', () => {
    const pares = calcularParesProximos([usuario(1, 5, 5), usuario(2, 6, 5, 'OFFLINE')], 2)
    expect(pares).toEqual([])
  })
})

describe('usuariosProximosDeAlguem', () => {
  it('junta os ids dos dois lados de cada par, sem duplicar', () => {
    const pares = [
      { usuarioIdA: 1, usuarioIdB: 2, distanciaTiles: 1 },
      { usuarioIdA: 2, usuarioIdB: 3, distanciaTiles: 1.5 },
    ]
    expect(usuariosProximosDeAlguem(pares)).toEqual(new Set([1, 2, 3]))
  })

  it('vazio quando não há pares', () => {
    expect(usuariosProximosDeAlguem([])).toEqual(new Set())
  })
})
