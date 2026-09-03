import type { ItemMobilia } from './tipos'

/**
 * Móveis/decoração do mundo - conteúdo só de frontend. Reaproveita as 4 zonas do backend
 * (`V24__redesenha_salas_por_funcao.sql`, mapa 28×20): Sala de reunião (REUNIAO) 1,1,7×6 / Café
 * (CAFE) 13,1,6×6 / Área de trabalho (FOCO) 1,10,12×8 / Fora do trabalho (LIVRE) 16,10,10×8, mais
 * o corredor/área aberta entre elas. Coordenadas em tiles, mesma origem/eixos das zonas. Tudo
 * desenhado via `PIXI.Graphics` (ver `spriteFactory.ts`), sem asset de imagem.
 *
 * Fase 6 (pedido "mais vivo, mais parecido com o Gather", com prints reais de referência): a
 * "Área de trabalho" era uma grade idêntica de 5×3 baias - lia como planta baixa de CAD, não uma
 * sala decorada à mão como nos prints. Virou 3 "pods" de mesas com espaçamento/props levemente
 * diferentes entre si, cada um com pelo menos 1 item que os outros não têm. As outras 3 salas
 * ganharam os móveis novos desta fase (`quadro`/`bebedouro`/`armario`/`puf`/`cafeteira`) pra
 * variedade, sem repetir os mesmos ~9 tipos de antes em todo canto. `aquario`/`planta` continuam
 * na mesma lista (mesmo formato de item) - só o desenho deles mudou de estático pra animado (ver
 * `CamadaMundo.tsx`, que filtra esses dois tipos pra fora do lote estático).
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
  { tipo: 'armario', x: 6, y: 2 },
  { tipo: 'quadro', x: 2, y: 1 },
  { tipo: 'quadro', x: 5, y: 1 },
  { tipo: 'tapete', x: 4, y: 3 },
  { tipo: 'planta', x: 2, y: 5 },
  { tipo: 'planta', x: 6, y: 5 },
  { tipo: 'aquario', x: 2, y: 6 },

  // ========== Comodo 2 — Café / Pausa (13,1,6×6) ==========
  { tipo: 'balcao', x: 14, y: 2 },
  { tipo: 'balcao', x: 15, y: 2 },
  { tipo: 'cafeteira', x: 16, y: 2 },
  { tipo: 'bebedouro', x: 18, y: 3 },
  { tipo: 'mesa', x: 14, y: 4 },
  { tipo: 'cadeira', x: 13, y: 4 },
  { tipo: 'cadeira', x: 14, y: 5 },
  { tipo: 'mesa', x: 17, y: 4 },
  { tipo: 'cadeira', x: 17, y: 3 },
  { tipo: 'cadeira', x: 17, y: 5 },
  { tipo: 'quadro', x: 15, y: 1 },
  { tipo: 'planta', x: 18, y: 2 },
  { tipo: 'planta', x: 13, y: 6 },
  { tipo: 'aquario', x: 16, y: 5 },

  // ========== Comodo 3 — Área de trabalho (1,10,12×8) — 3 pods, não mais um grid idêntico ==========
  // pod A — 3 mesas em fileira curta, canto noroeste
  { tipo: 'mesa', x: 2, y: 11 },
  { tipo: 'cadeira', x: 2, y: 12 },
  { tipo: 'mesa', x: 4, y: 11 },
  { tipo: 'cadeira', x: 4, y: 12 },
  { tipo: 'mesa', x: 6, y: 12 },
  { tipo: 'cadeira', x: 6, y: 13 },
  { tipo: 'estante', x: 1, y: 11 },
  { tipo: 'quadro', x: 3, y: 10 },

  // pod B — 4 mesas em par (2+2), meio da sala, levemente deslocado do pod A
  { tipo: 'mesa', x: 8, y: 11 },
  { tipo: 'cadeira', x: 8, y: 12 },
  { tipo: 'mesa', x: 10, y: 12 },
  { tipo: 'cadeira', x: 10, y: 13 },
  { tipo: 'mesa', x: 9, y: 14 },
  { tipo: 'cadeira', x: 9, y: 15 },
  { tipo: 'armario', x: 11, y: 11 },
  { tipo: 'aquario', x: 11, y: 13 },

  // pod C — 3 mesas, canto sudoeste, espaçamento mais aberto que os outros dois pods
  { tipo: 'mesa', x: 2, y: 15 },
  { tipo: 'cadeira', x: 2, y: 16 },
  { tipo: 'mesa', x: 5, y: 16 },
  { tipo: 'cadeira', x: 5, y: 17 },
  { tipo: 'mesa', x: 3, y: 17 },
  { tipo: 'cadeira', x: 3, y: 18 },
  { tipo: 'estante', x: 1, y: 17 },
  { tipo: 'planta', x: 1, y: 10 },
  { tipo: 'planta', x: 12, y: 10 },
  { tipo: 'tapete', x: 7, y: 17 },

  // ========== Comodo 4 — Fora do trabalho (16,10,10×8) ==========
  { tipo: 'sofa', x: 17, y: 11 },
  { tipo: 'sofa', x: 20, y: 11 },
  { tipo: 'mesaJogos', x: 23, y: 15, rotacao: 90 },
  { tipo: 'tapete', x: 17, y: 16 },
  { tipo: 'puf', x: 23, y: 11 },
  { tipo: 'puf', x: 24, y: 12 },
  { tipo: 'puf', x: 17, y: 13 },
  { tipo: 'estante', x: 25, y: 13 },
  { tipo: 'quadro', x: 25, y: 10 },
  { tipo: 'quadro', x: 19, y: 10 },
  { tipo: 'aquario', x: 24, y: 17 },
  { tipo: 'planta', x: 16, y: 13 },
  { tipo: 'planta', x: 16, y: 17 },
  { tipo: 'planta', x: 21, y: 17 },

  // ========== Corredor central e bordas do mapa ==========
  { tipo: 'mesa', x: 10, y: 8 },
  { tipo: 'cadeira', x: 10, y: 7 },
  { tipo: 'cadeira', x: 10, y: 9 },
  { tipo: 'estante', x: 6, y: 8 },
  { tipo: 'estante', x: 19, y: 8 },
  { tipo: 'quadro', x: 12, y: 8 },
  { tipo: 'quadro', x: 15, y: 8 },
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
  { tipo: 'planta', x: 21, y: 8 },
  { tipo: 'planta', x: 24, y: 8 },
]
