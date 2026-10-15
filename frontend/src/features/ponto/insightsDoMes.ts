import type { EspelhoDia } from './types'

export interface MelhorDia {
  data: string
  valor: number
}

export interface MelhorSemana {
  /** Segunda-feira da semana (AAAA-MM-DD). */
  inicio: string
  /** Domingo da semana (AAAA-MM-DD). */
  fim: string
  valor: number
}

export interface InsightsDoMes {
  totalMinutos: number
  diasTrabalhados: number
  mediaMinutosPorDiaTrabalhado: number
  melhorDia: MelhorDia | null
  melhorSemana: MelhorSemana | null
  /** Dia da semana (0 = domingo ... 6 = sábado) com a maior média de minutos entre os dias trabalhados. */
  diaDaSemanaMaisProdutivo: { diaDaSemana: number; mediaMinutos: number } | null
  diasInconsistentes: number
  tarefasConcluidas: number
  melhorDiaTarefas: MelhorDia | null
  melhorSemanaTarefas: MelhorSemana | null
}

const DIA_EM_MS = 24 * 60 * 60 * 1000

function paraData(dataIso: string): Date {
  return new Date(`${dataIso.slice(0, 10)}T00:00:00Z`)
}

function paraIso(data: Date): string {
  return data.toISOString().slice(0, 10)
}

/** Segunda-feira da semana de `dataIso` - semana de segunda a domingo, em UTC (mesma convenção de "dia" do sistema). */
function intervaloDaSemana(dataIso: string): { inicio: string; fim: string } {
  const data = paraData(dataIso)
  const deslocamentoAteSegunda = (data.getUTCDay() + 6) % 7
  const segunda = new Date(data.getTime() - deslocamentoAteSegunda * DIA_EM_MS)
  return { inicio: paraIso(segunda), fim: paraIso(new Date(segunda.getTime() + 6 * DIA_EM_MS)) }
}

/** Empate fica com o primeiro (mais antigo): a lista chega ordenada por data. */
function maiorPorChave(valorPorChave: Map<string, number>): [string, number] | null {
  let melhor: [string, number] | null = null
  for (const [chave, valor] of valorPorChave) {
    if (valor > 0 && (melhor === null || valor > melhor[1])) {
      melhor = [chave, valor]
    }
  }
  return melhor
}

function somarPor(itens: { data: string; valor: number }[], chaveDe: (data: string) => string): Map<string, number> {
  const somas = new Map<string, number>()
  for (const item of [...itens].sort((a, b) => a.data.localeCompare(b.data))) {
    const chave = chaveDe(item.data)
    somas.set(chave, (somas.get(chave) ?? 0) + item.valor)
  }
  return somas
}

function melhorSemanaDe(itens: { data: string; valor: number }[]): MelhorSemana | null {
  const melhor = maiorPorChave(somarPor(itens, (data) => intervaloDaSemana(data).inicio))
  if (melhor === null) return null
  return { inicio: melhor[0], fim: intervaloDaSemana(melhor[0]).fim, valor: melhor[1] }
}

function melhorDiaDe(itens: { data: string; valor: number }[]): MelhorDia | null {
  const melhor = maiorPorChave(somarPor(itens, (data) => data.slice(0, 10)))
  return melhor === null ? null : { data: melhor[0], valor: melhor[1] }
}

/**
 * Pedido do usuário: análises/mini dashboard do mês pra gerar insights - "que dia a pessoa
 * trabalhou mais tempo, a semana que ela trabalhou mais, fez mais tarefas". Tudo calculado no
 * navegador a partir do espelho do mês (horas por dia) e das tarefas concluídas do período, sem
 * endpoint novo. Dia e semana seguem UTC, como o resto do sistema (ADR 0010).
 */
export function calcularInsightsDoMes(dias: EspelhoDia[], datasDeTarefasConcluidas: string[]): InsightsDoMes {
  const horasPorDia = dias.map((dia) => ({ data: dia.data, valor: dia.minutosTrabalhados }))
  const diasComTrabalho = horasPorDia.filter((dia) => dia.valor > 0)
  const totalMinutos = diasComTrabalho.reduce((soma, dia) => soma + dia.valor, 0)

  const somaPorDiaDaSemana = new Array<number>(7).fill(0)
  const diasPorDiaDaSemana = new Array<number>(7).fill(0)
  for (const dia of diasComTrabalho) {
    const diaDaSemana = paraData(dia.data).getUTCDay()
    somaPorDiaDaSemana[diaDaSemana] += dia.valor
    diasPorDiaDaSemana[diaDaSemana] += 1
  }
  let diaDaSemanaMaisProdutivo: InsightsDoMes['diaDaSemanaMaisProdutivo'] = null
  for (let diaDaSemana = 0; diaDaSemana < 7; diaDaSemana++) {
    if (diasPorDiaDaSemana[diaDaSemana] === 0) continue
    const mediaMinutos = Math.floor(somaPorDiaDaSemana[diaDaSemana] / diasPorDiaDaSemana[diaDaSemana])
    if (diaDaSemanaMaisProdutivo === null || mediaMinutos > diaDaSemanaMaisProdutivo.mediaMinutos) {
      diaDaSemanaMaisProdutivo = { diaDaSemana, mediaMinutos }
    }
  }

  const tarefas = datasDeTarefasConcluidas.map((data) => ({ data, valor: 1 }))

  return {
    totalMinutos,
    diasTrabalhados: diasComTrabalho.length,
    mediaMinutosPorDiaTrabalhado: diasComTrabalho.length === 0 ? 0 : Math.floor(totalMinutos / diasComTrabalho.length),
    melhorDia: melhorDiaDe(horasPorDia),
    melhorSemana: melhorSemanaDe(horasPorDia),
    diaDaSemanaMaisProdutivo,
    diasInconsistentes: dias.filter((dia) => dia.estado === 'INCONSISTENTE').length,
    tarefasConcluidas: tarefas.length,
    melhorDiaTarefas: melhorDiaDe(tarefas),
    melhorSemanaTarefas: melhorSemanaDe(tarefas),
  }
}

const NOMES_DIA_DA_SEMANA = [
  'domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado',
]

export function nomeDoDiaDaSemana(diaDaSemana: number): string {
  return NOMES_DIA_DA_SEMANA[diaDaSemana]
}
