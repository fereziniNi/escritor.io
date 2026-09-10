/**
 * Sem paredes/portas de propósito pro resto do escritório (pedido do usuário: "remover as
 * paredes, deixar o mapa mais vivo") - salas continuam com identidade visual só pelo tingimento de
 * piso (`desenharPisoZonas`) e pela densidade de móveis, sem barreira física nem colisão.
 * `SegmentoParede`/`BordaZona` (`gerarParedesDeZona`/`construirGradeColisao`) tinham sido removidos
 * por completo nessa época - voltaram (pedido posterior: "cabines fechadas... devem ter paredes e
 * só é possível entrar por um lado"), mas escopados só pras zonas `CABINE` - o resto do mapa
 * continua sem parede/colisão.
 */
export interface SegmentoParede {
  x: number
  y: number
  orientacao: 'horizontal' | 'vertical'
  comprimento: number
}

export type BordaZona = 'norte' | 'sul' | 'leste' | 'oeste'

export type TipoMovel =
  | 'mesa'
  | 'cadeira'
  | 'planta'
  | 'estante'
  | 'balcao'
  | 'tapete'
  | 'sofa'
  | 'mesaJogos'
  | 'aquario'
  | 'quadro'
  | 'bebedouro'
  | 'armario'
  | 'puf'
  | 'cafeteira'

export interface ItemMobilia {
  tipo: TipoMovel
  x: number
  y: number
  rotacao?: 0 | 90 | 180 | 270
}
