import type { StatusAvatar, TipoZona, Zona } from '../types'
import type { PosicaoTile } from './movimento'

/**
 * Pra onde o personagem é levado ao escolher cada status (pedido do usuário: "se ela selecionar
 * o status... o personagem for redirecionado para o lugar que representa o status"). FOCO/REUNIAO
 * batem 1:1 com o `TipoZona` de mesmo nome; ALMOCO/AUSENTE não têm `TipoZona` homônimo mas casam
 * semanticamente com Café/Fora do trabalho. DISPONIVEL fica de fora de propósito - é o status
 * "neutro"/padrão, não tem um "lugar" específico que o represente, então escolhê-lo não move
 * ninguém.
 */
const TIPO_ZONA_POR_STATUS: Partial<Record<StatusAvatar, TipoZona>> = {
  FOCO: 'FOCO',
  REUNIAO: 'REUNIAO',
  ALMOCO: 'CAFE',
  AUSENTE: 'LIVRE',
}

/** Centro (arredondado pra baixo) da zona que representa o status escolhido, ou `null` se o
 * status não tem zona correspondente (DISPONIVEL) ou o mapa não tem essa zona seedada. */
export function calcularDestinoParaStatus(zonas: Zona[], status: StatusAvatar): PosicaoTile | null {
  const tipo = TIPO_ZONA_POR_STATUS[status]
  if (!tipo) {
    return null
  }
  const zona = zonas.find((z) => z.tipo === tipo)
  if (!zona) {
    return null
  }
  return {
    x: zona.x + Math.floor(zona.largura / 2),
    y: zona.y + Math.floor(zona.altura / 2),
  }
}
