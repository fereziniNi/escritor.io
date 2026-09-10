import { describe, expect, it } from 'vitest'
import { calcularParesDeVoz, calcularParesProximos, usuariosProximosDeAlguem } from './proximidade'
import { APARENCIA_PADRAO } from '../avatar/aparenciaAvatar'
import type { EstadoPresencaUsuario, StatusAvatar, Zona } from '../types'

function usuario(usuarioId: number, x: number, y: number, status: StatusAvatar = 'DISPONIVEL'): EstadoPresencaUsuario {
  return { usuarioId, nome: `Usuário ${usuarioId}`, x, y, status, aparencia: APARENCIA_PADRAO }
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

describe('calcularParesDeVoz', () => {
  const salaReuniao: Zona = { id: 10, nome: 'Sala de reunião', x: 0, y: 0, largura: 8, altura: 8, tipo: 'REUNIAO' }

  it('pedido do usuário: "podemos falar dentro da sala" - mesma zona conta mesmo fora do raio de proximidade', () => {
    const usuarios = [usuario(1, 0, 0), usuario(2, 7, 7)] // dentro da sala, mas longe um do outro
    const pares = calcularParesDeVoz(usuarios, 2, [salaReuniao])
    expect(pares).toEqual([{ usuarioIdA: 1, usuarioIdB: 2, distanciaTiles: Math.hypot(7, 7) }])
  })

  it('pedido do usuário: "ou com a pessoa mais próxima" - proximidade conta mesmo sem estar numa zona', () => {
    const usuarios = [usuario(1, 20, 20), usuario(2, 21, 20)] // fora de qualquer zona, mas perto
    const pares = calcularParesDeVoz(usuarios, 2, [salaReuniao])
    expect(pares).toEqual([{ usuarioIdA: 1, usuarioIdB: 2, distanciaTiles: 1 }])
  })

  it('não duplica quando o par já vale por proximidade E por estar na mesma sala', () => {
    const usuarios = [usuario(1, 1, 1), usuario(2, 2, 1)]
    const pares = calcularParesDeVoz(usuarios, 2, [salaReuniao])
    expect(pares).toHaveLength(1)
  })

  it('zonas diferentes não contam, mesmo perto uma da outra', () => {
    const outraSala: Zona = { id: 11, nome: 'Café', x: 10, y: 0, largura: 4, altura: 4, tipo: 'CAFE' }
    // usuário 1 encostado na borda da sala de reunião, usuário 2 encostado na borda do café -
    // fisicamente perto (raio grande), mas cada um numa zona diferente.
    const usuarios = [usuario(1, 7, 0), usuario(2, 10, 0)]
    const pares = calcularParesDeVoz(usuarios, 1, [salaReuniao, outraSala])
    expect(pares).toEqual([])
  })

  it('ignora quem está OFFLINE mesmo na mesma sala', () => {
    const usuarios = [usuario(1, 0, 0), usuario(2, 7, 7, 'OFFLINE')]
    expect(calcularParesDeVoz(usuarios, 2, [salaReuniao])).toEqual([])
  })

  it('sem zonas seedadas, se comporta igual calcularParesProximos', () => {
    const usuarios = [usuario(1, 0, 0), usuario(2, 1, 0)]
    expect(calcularParesDeVoz(usuarios, 2, [])).toEqual(calcularParesProximos(usuarios, 2))
  })

  describe('cabines fechadas', () => {
    const cabine1: Zona = { id: 20, nome: 'Cabine 1', x: 10, y: 1, largura: 2, altura: 2, tipo: 'CABINE' }
    const cabine2: Zona = { id: 21, nome: 'Cabine 2', x: 10, y: 4, largura: 2, altura: 2, tipo: 'CABINE' }

    it('pedido do usuário: "cabines fechadas... não escutar o barulho da sala" - isola quem está fora, mesmo dentro do raio normal', () => {
      // usuário 1 dentro da cabine, usuário 2 bem encostado na porta (fora, mas a 1 tile de
      // distância - dentro de qualquer raio normal de proximidade).
      const usuarios = [usuario(1, 10, 1), usuario(2, 12, 1)]
      const pares = calcularParesDeVoz(usuarios, 5, [cabine1])
      expect(pares).toEqual([])
    })

    it('duas pessoas na MESMA cabine se ouvem (a regra de "mesma sala" continua valendo)', () => {
      const usuarios = [usuario(1, 10, 1), usuario(2, 11, 2)]
      const pares = calcularParesDeVoz(usuarios, 0, [cabine1]) // raio 0 - só "mesma sala" pode parear
      expect(pares).toHaveLength(1)
      expect(pares[0]).toMatchObject({ usuarioIdA: 1, usuarioIdB: 2 })
    })

    it('duas cabines DIFERENTES não se ouvem entre si, mesmo perto uma da outra', () => {
      const usuarios = [usuario(1, 10, 2), usuario(2, 10, 4)] // um em cada cabine, bem na fronteira
      const pares = calcularParesDeVoz(usuarios, 5, [cabine1, cabine2])
      expect(pares).toEqual([])
    })

    it('salas normais (não-cabine) continuam permitindo proximidade entre zonas diferentes - só CABINE ganhou a regra nova', () => {
      const outraSala: Zona = { id: 11, nome: 'Café', x: 10, y: 0, largura: 4, altura: 4, tipo: 'CAFE' }
      // usuário 1 encostado na borda da sala de reunião, usuário 2 encostado na borda do café,
      // bem perto um do outro (raio grande o bastante pra pareá-los por proximidade de verdade).
      const usuarios = [usuario(1, 7, 0), usuario(2, 10, 0)]
      const pares = calcularParesDeVoz(usuarios, 5, [salaReuniao, outraSala])
      expect(pares).toEqual([{ usuarioIdA: 1, usuarioIdB: 2, distanciaTiles: 3 }])
    })
  })
})
