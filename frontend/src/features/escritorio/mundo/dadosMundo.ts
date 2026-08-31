import type { ItemMobilia, PortaOverride } from './tipos'

/** Override de borda de porta por id de zona - vazio por enquanto (as 3 zonas seedadas hoje usam
 * o padrão de porta na borda sul, que já funciona bem pra elas: todas ficam na fileira y=0..4 do
 * mapa, com a área aberta logo abaixo). */
export const PORTAS_OVERRIDE: PortaOverride[] = []

/**
 * Móveis/decoração do mundo - conteúdo só de frontend, sem migração de banco nova (o backend hoje
 * só sabe de 3 zonas retangulares pequenas, `V21__create_zona.sql`: Sala de foco 0,0,4×4 / Sala de
 * reunião 5,0,5×5 / Café 11,0,4×4, num mapa 20×15). Coordenadas em tiles, mesma origem/eixos das
 * zonas. Mantido junto de `PORTAS_OVERRIDE` porque os dois só fazem sentido lidos junto com a
 * geometria real das zonas vindas de `GET /mapas/ativo`.
 */
export const MOBILIA_MUNDO: ItemMobilia[] = [
  // Sala de foco (0,0,4×4)
  { tipo: 'mesa', x: 1, y: 1 },
  { tipo: 'cadeira', x: 1, y: 2 },
  { tipo: 'planta', x: 3, y: 3 },

  // Sala de reunião (5,0,5×5) - mesa grande ao centro, cadeiras dos dois lados
  { tipo: 'mesa', x: 7, y: 1, rotacao: 90 },
  { tipo: 'mesa', x: 7, y: 2, rotacao: 90 },
  { tipo: 'cadeira', x: 6, y: 1 },
  { tipo: 'cadeira', x: 6, y: 2 },
  { tipo: 'cadeira', x: 8, y: 1 },
  { tipo: 'cadeira', x: 8, y: 2 },

  // Café (11,0,4×4)
  { tipo: 'balcao', x: 12, y: 1 },
  { tipo: 'balcao', x: 13, y: 1 },
  { tipo: 'planta', x: 14, y: 3 },

  // baias soltas na área aberta
  { tipo: 'mesa', x: 2, y: 9 },
  { tipo: 'cadeira', x: 2, y: 10 },
  { tipo: 'mesa', x: 5, y: 9 },
  { tipo: 'cadeira', x: 5, y: 10 },
  { tipo: 'mesa', x: 8, y: 9 },
  { tipo: 'cadeira', x: 8, y: 10 },

  // canto de estar informal
  { tipo: 'tapete', x: 15, y: 9 },
  { tipo: 'estante', x: 17, y: 7 },

  // plantas decorativas nos cantos do mapa
  { tipo: 'planta', x: 0, y: 14 },
  { tipo: 'planta', x: 19, y: 14 },
  { tipo: 'planta', x: 19, y: 0 },
]
