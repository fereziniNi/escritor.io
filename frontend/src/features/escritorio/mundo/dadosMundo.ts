import type { TipoZona } from '../types'
import type { BordaZona, ItemMobilia } from './tipos'

/**
 * Pedido do usuário: "coloque parede em todas [as áreas]" - toda sala virou uma sala de verdade,
 * com parede e uma única porta (mesmo sistema que já existia só pras cabines, ver
 * `gerarParedesDeZona.ts`). A borda escolhida por tipo é a que abre pro corredor mais próximo:
 * REUNIAO/CAFE/HAPPY_HOUR (fileira de cima, y=6-12) abrem pro sul, direto no corredor horizontal
 * central (y=12-14); FOCO/LIVRE (fileira de baixo, y=15-23) abrem pro norte, no mesmo corredor;
 * CABINE (coluna à esquerda) continua abrindo pro leste, no corredor vertical ao lado dela.
 * Conferido à mão contra `MOBILIA_MUNDO` abaixo - nenhuma porta nasce bloqueada por móvel.
 */
export const BORDA_PORTA_POR_TIPO: Record<TipoZona, BordaZona> = {
  CABINE: 'leste',
  FOCO: 'norte',
  LIVRE: 'norte',
  REUNIAO: 'sul',
  CAFE: 'sul',
  HAPPY_HOUR: 'sul',
  ATENDIMENTO: 'sul',
}

/**
 * Móveis/decoração do mundo - conteúdo só de frontend. Reaproveita as 5 zonas do backend
 * (`V51__centraliza_mapa_verticalmente.sql`, mapa 36×27): Sala de reunião (REUNIAO) 7,6,7×6 /
 * Café (CAFE) 19,6,6×6 / Área de trabalho (FOCO) 7,15,12×8 / Fora do trabalho (LIVRE) 22,15,10×8,
 * mais o corredor/área aberta entre elas. Coordenadas em tiles, mesma origem/eixos das zonas.
 * Tudo desenhado via `PIXI.Graphics` (ver `spriteFactory.ts`), sem asset de imagem.
 *
 * Fase 6 (pedido "mais vivo, mais parecido com o Gather", com prints reais de referência): a
 * "Área de trabalho" era uma grade idêntica de 5×3 baias - lia como planta baixa de CAD, não uma
 * sala decorada à mão como nos prints. Virou 3 "pods" de mesas com espaçamento/props levemente
 * diferentes entre si, cada um com pelo menos 1 item que os outros não têm. As outras 3 salas
 * ganharam os móveis novos desta fase (`quadro`/`bebedouro`/`armario`/`puf`/`cafeteira`) pra
 * variedade, sem repetir os mesmos ~9 tipos de antes em todo canto. `aquario`/`planta` continuam
 * na mesma lista (mesmo formato de item) - só o desenho deles mudou de estático pra animado (ver
 * `CamadaMundo.tsx`, que filtra esses dois tipos pra fora do lote estático).
 *
 * Pedido do usuário (feedback sobre a V49 - "Não gostei. Aumente o espaço do escritório no geral.
 * Deixe as cabines na esquerda todas em coluna na vertical"): as 5 salas de sempre deslocaram
 * `x += 6` em bloco (mesma matemática da migração `V50`, só do lado da mobília, que não mora no
 * banco).
 *
 * Pedido posterior ("o mapa... tem 4 quadrados sem nada embaixo e só 1 em cima. Adicione mais 5
 * quadrados na parte de cima"): TODO item deste arquivo ganhou `y += 5` em bloco (mesma matemática
 * da migração `V51`) - empurra tudo pra baixo, sem mudar largura nem margem inferior.
 */
export const MOBILIA_MUNDO: ItemMobilia[] = [
  // ========== Comodo 1 — Sala de reunião (7,6,7×6) ==========
  { tipo: 'mesa', x: 10, y: 8, rotacao: 90 },
  { tipo: 'mesa', x: 10, y: 9, rotacao: 90 },
  { tipo: 'cadeira', x: 9, y: 8 },
  { tipo: 'cadeira', x: 9, y: 9 },
  { tipo: 'cadeira', x: 11, y: 8 },
  { tipo: 'cadeira', x: 11, y: 9 },
  { tipo: 'cadeira', x: 10, y: 7 },
  { tipo: 'cadeira', x: 10, y: 10 },
  { tipo: 'estante', x: 8, y: 7 },
  { tipo: 'armario', x: 12, y: 7 },
  { tipo: 'quadro', x: 8, y: 6 },
  { tipo: 'quadro', x: 11, y: 6 },
  { tipo: 'tapete', x: 10, y: 8 },
  { tipo: 'planta', x: 8, y: 10 },
  { tipo: 'planta', x: 12, y: 10 },
  { tipo: 'aquario', x: 8, y: 11 },

  // ========== Comodo 2 — Café / Pausa (19,6,6×6) ==========
  { tipo: 'balcao', x: 20, y: 7 },
  { tipo: 'balcao', x: 21, y: 7 },
  { tipo: 'cafeteira', x: 22, y: 7 },
  { tipo: 'bebedouro', x: 24, y: 8 },
  { tipo: 'mesa', x: 20, y: 9 },
  { tipo: 'cadeira', x: 19, y: 9 },
  { tipo: 'cadeira', x: 20, y: 10 },
  { tipo: 'mesa', x: 23, y: 9 },
  { tipo: 'cadeira', x: 23, y: 8 },
  { tipo: 'cadeira', x: 23, y: 10 },
  { tipo: 'quadro', x: 21, y: 6 },
  { tipo: 'planta', x: 24, y: 7 },
  { tipo: 'planta', x: 19, y: 11 },
  { tipo: 'aquario', x: 22, y: 10 },

  // ========== Comodo 3 — Área de trabalho (7,15,12×8) — 3 pods, não mais um grid idêntico ==========
  // pod A — 3 mesas em fileira curta, canto noroeste
  { tipo: 'mesa', x: 8, y: 16 },
  { tipo: 'cadeira', x: 8, y: 17 },
  { tipo: 'mesa', x: 10, y: 16 },
  { tipo: 'cadeira', x: 10, y: 17 },
  { tipo: 'mesa', x: 12, y: 17 },
  { tipo: 'cadeira', x: 12, y: 18 },
  { tipo: 'estante', x: 7, y: 16 },
  { tipo: 'quadro', x: 9, y: 15 },

  // pod B — 4 mesas em par (2+2), meio da sala, levemente deslocado do pod A
  { tipo: 'mesa', x: 14, y: 16 },
  { tipo: 'cadeira', x: 14, y: 17 },
  { tipo: 'mesa', x: 16, y: 17 },
  { tipo: 'cadeira', x: 16, y: 18 },
  { tipo: 'mesa', x: 15, y: 19 },
  { tipo: 'cadeira', x: 15, y: 20 },
  { tipo: 'armario', x: 17, y: 16 },
  { tipo: 'aquario', x: 17, y: 18 },

  // pod C — 3 mesas, canto sudoeste, espaçamento mais aberto que os outros dois pods
  { tipo: 'mesa', x: 8, y: 20 },
  { tipo: 'cadeira', x: 8, y: 21 },
  { tipo: 'mesa', x: 11, y: 21 },
  { tipo: 'cadeira', x: 11, y: 22 },
  { tipo: 'mesa', x: 9, y: 22 },
  { tipo: 'cadeira', x: 9, y: 23 },
  { tipo: 'estante', x: 7, y: 22 },
  { tipo: 'planta', x: 7, y: 15 },
  { tipo: 'planta', x: 18, y: 15 },
  { tipo: 'tapete', x: 13, y: 22 },

  // ========== Comodo 4 — Fora do trabalho (22,15,10×8) ==========
  { tipo: 'sofa', x: 23, y: 16 },
  { tipo: 'sofa', x: 26, y: 16 },
  { tipo: 'mesaJogos', x: 29, y: 20, rotacao: 90 },
  { tipo: 'tapete', x: 23, y: 21 },
  { tipo: 'puf', x: 29, y: 16 },
  { tipo: 'puf', x: 30, y: 17 },
  { tipo: 'puf', x: 23, y: 18 },
  { tipo: 'estante', x: 31, y: 18 },
  { tipo: 'quadro', x: 31, y: 15 },
  { tipo: 'quadro', x: 25, y: 15 },
  { tipo: 'aquario', x: 30, y: 22 },
  { tipo: 'planta', x: 22, y: 18 },
  { tipo: 'planta', x: 22, y: 22 },
  { tipo: 'planta', x: 27, y: 22 },

  // ========== Corredor central e bordas do mapa ==========
  { tipo: 'mesa', x: 16, y: 13 },
  { tipo: 'cadeira', x: 16, y: 12 },
  { tipo: 'cadeira', x: 16, y: 14 },
  { tipo: 'estante', x: 12, y: 13 },
  { tipo: 'estante', x: 25, y: 13 },
  { tipo: 'quadro', x: 18, y: 13 },
  { tipo: 'quadro', x: 21, y: 13 },
  { tipo: 'tapete', x: 18, y: 13 },
  { tipo: 'aquario', x: 20, y: 13 },
  { tipo: 'planta', x: 6, y: 5 },
  { tipo: 'planta', x: 6, y: 13 },
  { tipo: 'planta', x: 6, y: 24 },
  { tipo: 'planta', x: 33, y: 5 },
  { tipo: 'planta', x: 33, y: 13 },
  { tipo: 'planta', x: 33, y: 24 },
  { tipo: 'planta', x: 9, y: 13 },
  { tipo: 'planta', x: 15, y: 13 },
  { tipo: 'planta', x: 27, y: 13 },
  { tipo: 'planta', x: 30, y: 13 },

  // ========== Cabines fechadas (V51__centraliza_mapa_verticalmente.sql) ==========
  // Pedido do usuário: "cabines fechadas para caso os usuários não possam e não queiram escutar o
  // barulho da sala... Deixe as cabines na esquerda todas em coluna na vertical" - coluna vertical
  // em x=1, cada uma 3×3 com parede/porta de verdade (ver `gerarParedesDeZona`/`CamadaMundo.tsx`).
  // 1 cadeira só por cabine, de propósito ("um lugar pra uma pessoa só", não uma mesa compartilhada
  // como as outras salas), centralizada no tile do meio de cada uma.
  { tipo: 'cadeira', x: 2, y: 7 }, // Cabine 1 (1,6,3×3)
  { tipo: 'cadeira', x: 2, y: 12 }, // Cabine 2 (1,11,3×3)
  { tipo: 'cadeira', x: 2, y: 17 }, // Cabine 3 (1,16,3×3)
]
