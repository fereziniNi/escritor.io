import type { ItemMobilia } from './tipos'

/**
 * Móveis/decoração do mundo - conteúdo só de frontend, densidade bem maior que a versão anterior
 * (usuário achou o mapa "com muita pouca coisa" depois que as paredes saíram: "polua a tela com
 * mais coisas, deixe o mapa mais vivo"). Reaproveita as 4 zonas do backend
 * (`V24__redesenha_salas_por_funcao.sql`, mapa 28×20): Sala de reunião (REUNIAO) 1,1,7×6 / Café
 * (CAFE) 13,1,6×6 / Área de trabalho (FOCO) 1,10,12×8 / Fora do trabalho (LIVRE) 16,10,10×8 - mas
 * agora também povoa densamente o corredor/área aberta entre elas, que antes ficava vazio.
 * Coordenadas em tiles, mesma origem/eixos das zonas. Tudo desenhado via `PIXI.Graphics`, sem
 * asset de imagem (mesmo princípio do resto do mundo).
 */
export const MOBILIA_MUNDO: ItemMobilia[] = [
  // ========== Comodo 1 — Sala de reunião (1,1,7×6) ==========
  { tipo: 'mesa', x: 4, y: 3, rotacao: 90 },
  { tipo: 'mesa', x: 4, y: 4, rotacao: 90 },
  { tipo: 'cadeira', x: 3, y: 3 },
  { tipo: 'cadeira', x: 3, y: 4 },
  { tipo: 'cadeira', x: 5, y: 3 },
  { tipo: 'cadeira', x: 5, y: 4 },
  { tipo: 'cadeira', x: 4, y: 2 },
  { tipo: 'cadeira', x: 4, y: 5 },
  { tipo: 'estante', x: 2, y: 2 },
  { tipo: 'estante', x: 6, y: 2 },
  { tipo: 'tapete', x: 4, y: 3 },
  { tipo: 'planta', x: 2, y: 5 },
  { tipo: 'planta', x: 6, y: 5 },
  { tipo: 'aquario', x: 2, y: 6 },
  { tipo: 'aquario', x: 6, y: 6 },

  // ========== Comodo 2 — Café / Pausa (13,1,6×6) ==========
  { tipo: 'balcao', x: 14, y: 2 },
  { tipo: 'balcao', x: 15, y: 2 },
  { tipo: 'balcao', x: 16, y: 2 },
  { tipo: 'mesa', x: 14, y: 4 },
  { tipo: 'cadeira', x: 13, y: 4 },
  { tipo: 'cadeira', x: 14, y: 5 },
  { tipo: 'mesa', x: 17, y: 4 },
  { tipo: 'cadeira', x: 17, y: 3 },
  { tipo: 'cadeira', x: 17, y: 5 },
  { tipo: 'planta', x: 18, y: 2 },
  { tipo: 'planta', x: 13, y: 6 },
  { tipo: 'aquario', x: 16, y: 5 },

  // ========== Comodo 3 — Área de trabalho (1,10,12×8) — 3 fileiras de baias ==========
  { tipo: 'mesa', x: 2, y: 11 },
  { tipo: 'cadeira', x: 2, y: 12 },
  { tipo: 'mesa', x: 4, y: 11 },
  { tipo: 'cadeira', x: 4, y: 12 },
  { tipo: 'mesa', x: 6, y: 11 },
  { tipo: 'cadeira', x: 6, y: 12 },
  { tipo: 'mesa', x: 8, y: 11 },
  { tipo: 'cadeira', x: 8, y: 12 },
  { tipo: 'mesa', x: 10, y: 11 },
  { tipo: 'cadeira', x: 10, y: 12 },

  { tipo: 'mesa', x: 2, y: 13 },
  { tipo: 'cadeira', x: 2, y: 14 },
  { tipo: 'mesa', x: 4, y: 13 },
  { tipo: 'cadeira', x: 4, y: 14 },
  { tipo: 'mesa', x: 6, y: 13 },
  { tipo: 'cadeira', x: 6, y: 14 },
  { tipo: 'mesa', x: 8, y: 13 },
  { tipo: 'cadeira', x: 8, y: 14 },
  { tipo: 'mesa', x: 10, y: 13 },
  { tipo: 'cadeira', x: 10, y: 14 },

  { tipo: 'mesa', x: 2, y: 15 },
  { tipo: 'cadeira', x: 2, y: 16 },
  { tipo: 'mesa', x: 4, y: 15 },
  { tipo: 'cadeira', x: 4, y: 16 },
  { tipo: 'mesa', x: 6, y: 15 },
  { tipo: 'cadeira', x: 6, y: 16 },
  { tipo: 'mesa', x: 8, y: 15 },
  { tipo: 'cadeira', x: 8, y: 16 },
  { tipo: 'mesa', x: 10, y: 15 },
  { tipo: 'cadeira', x: 10, y: 16 },

  { tipo: 'estante', x: 11, y: 11 },
  { tipo: 'estante', x: 11, y: 17 },
  { tipo: 'tapete', x: 11, y: 14 },
  { tipo: 'planta', x: 1, y: 10 },
  { tipo: 'planta', x: 1, y: 17 },
  { tipo: 'planta', x: 12, y: 10 },
  { tipo: 'aquario', x: 1, y: 13 },

  // ========== Comodo 4 — Fora do trabalho (16,10,10×8) ==========
  { tipo: 'sofa', x: 17, y: 11 },
  { tipo: 'sofa', x: 20, y: 11 },
  { tipo: 'sofa', x: 23, y: 11 },
  { tipo: 'mesaJogos', x: 19, y: 14 },
  { tipo: 'mesaJogos', x: 23, y: 15, rotacao: 90 },
  { tipo: 'tapete', x: 17, y: 16 },
  { tipo: 'estante', x: 25, y: 13 },
  { tipo: 'estante', x: 25, y: 17 },
  { tipo: 'aquario', x: 24, y: 11 },
  { tipo: 'planta', x: 16, y: 13 },
  { tipo: 'planta', x: 16, y: 17 },
  { tipo: 'planta', x: 21, y: 17 },
  { tipo: 'planta', x: 24, y: 17 },

  // ========== Corredor central e bordas do mapa ==========
  { tipo: 'mesa', x: 10, y: 8 },
  { tipo: 'cadeira', x: 10, y: 7 },
  { tipo: 'cadeira', x: 10, y: 9 },
  { tipo: 'estante', x: 6, y: 8 },
  { tipo: 'estante', x: 19, y: 8 },
  { tipo: 'tapete', x: 12, y: 8 },
  { tipo: 'aquario', x: 14, y: 8 },
  { tipo: 'planta', x: 0, y: 0 },
  { tipo: 'planta', x: 0, y: 8 },
  { tipo: 'planta', x: 0, y: 19 },
  { tipo: 'planta', x: 27, y: 0 },
  { tipo: 'planta', x: 27, y: 8 },
  { tipo: 'planta', x: 27, y: 19 },
  { tipo: 'planta', x: 3, y: 8 },
  { tipo: 'planta', x: 9, y: 8 },
  { tipo: 'planta', x: 15, y: 8 },
  { tipo: 'planta', x: 21, y: 8 },
  { tipo: 'planta', x: 24, y: 8 },
]
