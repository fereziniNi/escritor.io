/**
 * Conversão entre "linha da grade de horário" (slots de 30min, estilo Google Agenda) e "HH:mm" -
 * usada pelas visões de Semana/Dia (`CalendarioSemana.tsx`/`CalendarioDia.tsx`) tanto pra
 * posicionar o bloco trabalhado quanto pra transformar o slot clicado/arrastado num horário.
 * Faixa fixa 06:00-22:00 (16h, 32 slots de 30min) - cobre qualquer expediente razoável sem
 * precisar de scroll numa grade de 24h.
 */
export const HORA_INICIO_GRADE = 6
export const HORA_FIM_GRADE = 22
export const MINUTOS_POR_SLOT = 30
export const TOTAL_SLOTS = ((HORA_FIM_GRADE - HORA_INICIO_GRADE) * 60) / MINUTOS_POR_SLOT

export const HORAS_DO_ROTULO = Array.from({ length: HORA_FIM_GRADE - HORA_INICIO_GRADE + 1 }, (_, i) => HORA_INICIO_GRADE + i)

function comZero(numero: number, digitos: number): string {
  return String(numero).padStart(digitos, '0')
}

function minutosDesdeMeiaNoite(hora: string): number {
  const [horas, minutos] = hora.split(':').map(Number)
  return horas * 60 + minutos
}

/** Slot (0-indexado) em que um horário "HH:mm" cai, sempre dentro de [0, TOTAL_SLOTS]. */
export function horaParaSlot(hora: string): number {
  const minutos = minutosDesdeMeiaNoite(hora) - HORA_INICIO_GRADE * 60
  const slot = Math.round(minutos / MINUTOS_POR_SLOT)
  return Math.min(Math.max(slot, 0), TOTAL_SLOTS)
}

/** Início do slot (0-indexado) como "HH:mm". */
export function slotParaHora(slot: number): string {
  const minutosTotais = HORA_INICIO_GRADE * 60 + slot * MINUTOS_POR_SLOT
  return `${comZero(Math.floor(minutosTotais / 60), 2)}:${comZero(minutosTotais % 60, 2)}`
}
