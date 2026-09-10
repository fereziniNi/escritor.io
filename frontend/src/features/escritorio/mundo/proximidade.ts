import type { EstadoPresencaUsuario, Zona } from '../types'
import { zonaContendo } from './localizarZona'

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
 * inclui a diagonal, como esperado de proximidade espacial de verdade. Ignora quem está OFFLINE -
 * são avatares estacionados em "Fora do trabalho" pelo backend (desconectaram), não tem ninguém
 * de verdade ali pra estar "perto" - sem isso, um avatar fantasma dispararia notificação de
 * proximidade pra quem só está passando pela sala.
 */
export function calcularParesProximos(usuarios: EstadoPresencaUsuario[], raioTiles: number): ParProximo[] {
  const online = usuarios.filter((usuario) => usuario.status !== 'OFFLINE')
  const pares: ParProximo[] = []

  for (let i = 0; i < online.length; i++) {
    for (let j = i + 1; j < online.length; j++) {
      const a = online[i]
      const b = online[j]
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

function chaveDoPar(idA: number, idB: number): string {
  return idA < idB ? `${idA}-${idB}` : `${idB}-${idA}`
}

/** Pedido do usuário: "cabines fechadas para caso os usuários não possam e não queiram escutar o
 * barulho da sala" - zona `CABINE` isola de verdade: ninguém de fora ouve/é ouvido através dela,
 * mesmo perto o bastante pro raio normal (diferente de qualquer outra zona, onde o som atravessa
 * livremente pra fora - mapa sem colisão de propósito, "área aberta"). */
function estaIsolado(zona: Zona | null): boolean {
  return zona?.tipo === 'CABINE'
}

/**
 * Pedido do usuário: "podemos falar dentro da sala, somente quem esta no ambiente, ou podemos
 * falar com a pessoa mais próxima e so ela ouve" - une as duas ideias em vez de escolher só uma:
 * dois usuários se ouvem se estiverem na MESMA zona (sala inteira - útil pra uma sala de reunião
 * onde as pessoas se espalham, distância exata não importa) OU dentro do raio de proximidade de
 * sempre (corredores/área aberta, sem zona). Reaproveita {@link calcularParesProximos} como base -
 * só adiciona os pares "mesma sala" que ainda não estavam lá, sem duplicar. Mesmo formato de
 * retorno (`ParProximo[]`) - `distanciaTiles` de um par "só mesma sala" ainda é a distância real
 * (pode ser maior que `raioTiles`), usado pro cálculo de volume não bater sozinho num "cheio"
 * artificial quando os dois estão espalhados pela sala.
 *
 * Pedido posterior: "cabines fechadas..." - o pareamento por PROXIMIDADE (não o de "mesma sala",
 * que segue igual) passa a respeitar {@link estaIsolado}: se uma das duas pessoas está numa
 * cabine e elas não estão na MESMA instância (mesmo `zona.id` - aí a regra de "mesma sala" abaixo
 * já cobre), o par não conta, não importa a distância.
 */
export function calcularParesDeVoz(usuarios: EstadoPresencaUsuario[], raioTiles: number, zonas: Zona[]): ParProximo[] {
  const zonaPorUsuario = new Map(usuarios.map((usuario) => [usuario.usuarioId, zonaContendo(zonas, usuario.x, usuario.y)]))
  const porProximidade = calcularParesProximos(usuarios, raioTiles).filter((par) => {
    const zonaA = zonaPorUsuario.get(par.usuarioIdA) ?? null
    const zonaB = zonaPorUsuario.get(par.usuarioIdB) ?? null
    if (!estaIsolado(zonaA) && !estaIsolado(zonaB)) {
      return true
    }
    return zonaA?.id === zonaB?.id
  })
  const chavesJaIncluidas = new Set(porProximidade.map((par) => chaveDoPar(par.usuarioIdA, par.usuarioIdB)))
  const online = usuarios.filter((usuario) => usuario.status !== 'OFFLINE')
  const resultado = [...porProximidade]

  for (let i = 0; i < online.length; i++) {
    for (let j = i + 1; j < online.length; j++) {
      const a = online[i]
      const b = online[j]
      const chave = chaveDoPar(a.usuarioId, b.usuarioId)
      if (chavesJaIncluidas.has(chave)) {
        continue
      }
      const zonaA = zonaContendo(zonas, a.x, a.y)
      const zonaB = zonaContendo(zonas, b.x, b.y)
      if (zonaA && zonaB && zonaA.id === zonaB.id) {
        resultado.push({ usuarioIdA: a.usuarioId, usuarioIdB: b.usuarioId, distanciaTiles: Math.hypot(a.x - b.x, a.y - b.y) })
        chavesJaIncluidas.add(chave)
      }
    }
  }

  return resultado
}

/**
 * Pedido do usuário: "voice" espírito Gather (spatial audio de verdade) - mais perto, mais alto.
 * `distanciaTiles <= raioTiles` cai linearmente até um piso audível (nunca silêncio total só por
 * estar na borda do raio); `distanciaTiles` maior que `raioTiles` só é possível quando o par
 * existe por estarem na MESMA sala (ver {@link calcularParesDeVoz}) - nesse caso é sempre volume
 * cheio, a distância exata dentro da sala não importa (pedido: "podemos falar dentro da sala").
 */
export function calcularVolumePorDistancia(distanciaTiles: number, raioTiles: number): number {
  if (distanciaTiles > raioTiles) {
    return 1
  }
  const PISO_AUDIVEL = 0.25
  const fatorProximidade = 1 - distanciaTiles / raioTiles
  return PISO_AUDIVEL + fatorProximidade * (1 - PISO_AUDIVEL)
}
