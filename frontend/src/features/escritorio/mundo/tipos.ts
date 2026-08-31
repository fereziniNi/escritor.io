/**
 * Sem paredes/portas de propósito (pedido do usuário: "remover as paredes, deixar o mapa mais
 * vivo") - salas continuam com identidade visual só pelo tingimento de piso (`desenharZonas`) e
 * pela densidade de móveis, sem barreira física nem colisão. `SegmentoParede`/`PortaOverride`
 * (gerarParedesDeZona/construirGradeColisao) existiam antes e foram removidos por completo, não
 * só desativados.
 */
export type TipoMovel = 'mesa' | 'cadeira' | 'planta' | 'estante' | 'balcao' | 'tapete' | 'sofa' | 'mesaJogos' | 'aquario'

export interface ItemMobilia {
  tipo: TipoMovel
  x: number
  y: number
  rotacao?: 0 | 90 | 180 | 270
}
