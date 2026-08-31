import type { ItemMobilia, PortaOverride } from './tipos'

/** Override de borda de porta por id de zona - vazio (as 4 salas do layout novo,
 * V24__redesenha_salas_por_funcao.sql, usam todas o padrão de porta na borda sul, abrindo pro
 * corredor central). */
export const PORTAS_OVERRIDE: PortaOverride[] = []

/**
 * Móveis/decoração do mundo - conteúdo só de frontend, redesenhado a partir de uma referência
 * visual de escritório virtual (usuário pediu 4 salas por função: Reuniões, Pausa/Café,
 * Trabalhando, Fora do trabalho). Reaproveita os 4 tipos de zona do backend
 * (`V24__redesenha_salas_por_funcao.sql`, mapa 28×20): Sala de reunião (REUNIAO) 1,1,7×6 / Café
 * (CAFE) 13,1,6×6 / Área de trabalho (FOCO) 1,10,12×8 / Fora do trabalho (LIVRE) 16,10,10×8.
 * Móveis desenhados via `PIXI.Graphics` (sem asset de imagem, mesmo princípio do resto do mundo) -
 * a referência foi usada como inspiração de composição/densidade, não copiada literalmente.
 */
export const MOBILIA_MUNDO: ItemMobilia[] = [
  // ---------- Comodo 1 — Sala de reunião (1,1,7×6) ----------
  { tipo: 'mesa', x: 4, y: 3, rotacao: 90 },
  { tipo: 'mesa', x: 4, y: 4, rotacao: 90 },
  { tipo: 'cadeira', x: 3, y: 3 },
  { tipo: 'cadeira', x: 3, y: 4 },
  { tipo: 'cadeira', x: 5, y: 3 },
  { tipo: 'cadeira', x: 5, y: 4 },
  { tipo: 'cadeira', x: 4, y: 2 },
  { tipo: 'cadeira', x: 4, y: 5 },
  { tipo: 'estante', x: 2, y: 2 },
  { tipo: 'planta', x: 6, y: 5 },

  // ---------- Comodo 2 — Café / Pausa (13,1,6×6) ----------
  { tipo: 'balcao', x: 14, y: 2 },
  { tipo: 'balcao', x: 15, y: 2 },
  { tipo: 'mesa', x: 15, y: 4 },
  { tipo: 'cadeira', x: 14, y: 4 },
  { tipo: 'cadeira', x: 16, y: 4 },
  { tipo: 'planta', x: 17, y: 2 },
  { tipo: 'planta', x: 13, y: 5 },

  // ---------- Comodo 3 — Área de trabalho (1,10,12×8) ----------
  // baia A (3 mesas)
  { tipo: 'mesa', x: 2, y: 11 },
  { tipo: 'cadeira', x: 2, y: 12 },
  { tipo: 'mesa', x: 4, y: 11 },
  { tipo: 'cadeira', x: 4, y: 12 },
  { tipo: 'mesa', x: 6, y: 11 },
  { tipo: 'cadeira', x: 6, y: 12 },
  // baia B (2 mesas)
  { tipo: 'mesa', x: 8, y: 11 },
  { tipo: 'cadeira', x: 8, y: 12 },
  { tipo: 'mesa', x: 10, y: 11 },
  { tipo: 'cadeira', x: 10, y: 12 },
  // baia C (5 mesas)
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
  { tipo: 'estante', x: 11, y: 17 },
  { tipo: 'planta', x: 1, y: 17 },
  { tipo: 'planta', x: 11, y: 10 },

  // ---------- Comodo 4 — Fora do trabalho (16,10,10×8) ----------
  { tipo: 'sofa', x: 17, y: 11 },
  { tipo: 'sofa', x: 20, y: 11 },
  { tipo: 'mesaJogos', x: 23, y: 12 },
  { tipo: 'tapete', x: 19, y: 14 },
  { tipo: 'estante', x: 25, y: 11 },
  { tipo: 'planta', x: 17, y: 16 },
  { tipo: 'planta', x: 24, y: 16 },

  // ---------- corredor central ----------
  { tipo: 'planta', x: 9, y: 8 },
  { tipo: 'planta', x: 20, y: 8 },

  // plantas decorativas nos cantos do mapa
  { tipo: 'planta', x: 0, y: 19 },
  { tipo: 'planta', x: 27, y: 19 },
  { tipo: 'planta', x: 27, y: 0 },
]
