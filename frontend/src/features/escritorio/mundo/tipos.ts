/** Segmento de parede em coordenadas de tile (não px) - `comprimento` é medido ao longo do eixo
 * da orientação (horizontal → eixo x, vertical → eixo y). */
export interface SegmentoParede {
  x: number
  y: number
  orientacao: 'horizontal' | 'vertical'
  comprimento: number
}

export type BordaZona = 'norte' | 'sul' | 'leste' | 'oeste'

/** Override manual de em qual borda de uma zona específica fica a porta (padrão: sul). */
export interface PortaOverride {
  zonaId: number
  borda: BordaZona
}

export type TipoMovel = 'mesa' | 'cadeira' | 'planta' | 'estante' | 'balcao' | 'tapete'

export interface ItemMobilia {
  tipo: TipoMovel
  x: number
  y: number
  rotacao?: 0 | 90 | 180 | 270
}
