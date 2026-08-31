import type { ItemMobilia, PortaOverride } from './tipos'

/** Override de borda de porta por id de zona - vazio por enquanto (as 4 zonas do layout novo,
 * V23__reorganiza_zonas_do_mapa.sql, usam todas o padrão de porta na borda sul, que já abre pro
 * corredor/área aberta em qualquer uma delas). */
export const PORTAS_OVERRIDE: PortaOverride[] = []

/**
 * Móveis/decoração do mundo - conteúdo só de frontend, layout redesenhado (usuário não gostou da
 * organização original: as 3 salas ficavam todas espremidas numa fileira só no topo, com o resto
 * do mapa vazio). Agora as 4 zonas do backend (`V23__reorganiza_zonas_do_mapa.sql`: Sala de foco
 * 1,1,4×4 / Recepção 8,1,4×3 / Café 14,1,4×4 / Sala de reunião 1,9,5×5, mapa 20×15) ficam
 * espalhadas pelos cantos, com um corredor central de verdade entre elas - e a área aberta ganhou
 * dois grupos de baias + um canto de estar em vez de mesas soltas aleatórias. Coordenadas em
 * tiles, mesma origem/eixos das zonas.
 */
export const MOBILIA_MUNDO: ItemMobilia[] = [
  // Sala de foco (1,1,4×4)
  { tipo: 'mesa', x: 2, y: 2 },
  { tipo: 'cadeira', x: 2, y: 3 },
  { tipo: 'planta', x: 4, y: 4 },

  // Recepção (8,1,4×3) - balcão de entrada
  { tipo: 'balcao', x: 9, y: 2 },
  { tipo: 'balcao', x: 10, y: 2 },
  { tipo: 'planta', x: 11, y: 3 },

  // Café (14,1,4×4)
  { tipo: 'balcao', x: 15, y: 2 },
  { tipo: 'balcao', x: 16, y: 2 },
  { tipo: 'planta', x: 17, y: 4 },

  // Sala de reunião (1,9,5×5) - mesa grande ao centro, cadeiras dos dois lados
  { tipo: 'mesa', x: 3, y: 10, rotacao: 90 },
  { tipo: 'mesa', x: 3, y: 11, rotacao: 90 },
  { tipo: 'cadeira', x: 2, y: 10 },
  { tipo: 'cadeira', x: 2, y: 11 },
  { tipo: 'cadeira', x: 4, y: 10 },
  { tipo: 'cadeira', x: 4, y: 11 },

  // baias soltas no corredor central, logo abaixo da Recepção
  { tipo: 'mesa', x: 9, y: 6 },
  { tipo: 'cadeira', x: 9, y: 7 },
  { tipo: 'mesa', x: 12, y: 6 },
  { tipo: 'cadeira', x: 12, y: 7 },

  // segundo grupo de baias na área aberta à direita/embaixo
  { tipo: 'mesa', x: 9, y: 10 },
  { tipo: 'cadeira', x: 9, y: 11 },
  { tipo: 'mesa', x: 13, y: 10 },
  { tipo: 'cadeira', x: 13, y: 11 },
  { tipo: 'mesa', x: 17, y: 10 },
  { tipo: 'cadeira', x: 17, y: 11 },

  // canto de estar informal
  { tipo: 'tapete', x: 15, y: 7 },
  { tipo: 'estante', x: 17, y: 6 },

  // plantas decorativas nos cantos do mapa
  { tipo: 'planta', x: 0, y: 14 },
  { tipo: 'planta', x: 19, y: 14 },
  { tipo: 'planta', x: 19, y: 0 },
]
