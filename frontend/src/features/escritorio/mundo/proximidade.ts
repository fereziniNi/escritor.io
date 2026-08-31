import type { EstadoPresencaUsuario } from '../types'

/** Um par de usuários que estão próximos o suficiente pra a UI reagir. */
export interface ParProximo {
  usuarioIdA: number
  usuarioIdB: number
  distanciaTiles: number
}

/**
 * Encontra todos os pares de usuários dentro do raio de proximidade, usando a posição real em
 * tile (x,y) que já vem do servidor - nunca posição de tela/DOM (o mundo pode estar em qualquer
 * zoom/pan, isso não deve mudar quem está "perto"). Distância euclidiana, não Manhattan - "perto"
 * inclui a diagonal, como esperado de proximidade espacial de verdade.
 */
export function calcularParesProximos(usuarios: EstadoPresencaUsuario[], raioTiles: number): ParProximo[] {
  const pares: ParProximo[] = []

  for (let i = 0; i < usuarios.length; i++) {
    for (let j = i + 1; j < usuarios.length; j++) {
      const a = usuarios[i]
      const b = usuarios[j]
      const distanciaTiles = Math.hypot(a.x - b.x, a.y - b.y)
      if (distanciaTiles <= raioTiles) {
        pares.push({ usuarioIdA: a.usuarioId, usuarioIdB: b.usuarioId, distanciaTiles })
      }
    }
  }

  return pares
}

/** Conjunto de ids de usuário que estão próximos de pelo menos alguém - conveniente pra decidir
 * "esse avatar/linha da lista deve ganhar destaque de proximidade?" sem percorrer os pares de novo. */
export function usuariosProximosDeAlguem(pares: ParProximo[]): Set<number> {
  const ids = new Set<number>()
  for (const par of pares) {
    ids.add(par.usuarioIdA)
    ids.add(par.usuarioIdB)
  }
  return ids
}
