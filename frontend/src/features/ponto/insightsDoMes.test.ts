import { describe, expect, it } from 'vitest'
import { calcularInsightsDoMes, nomeDoDiaDaSemana } from './insightsDoMes'
import type { EspelhoDia } from './types'

function dia(data: string, minutosTrabalhados: number, estado: EspelhoDia['estado'] = 'FECHADA'): EspelhoDia {
  return { data, estado, minutosTrabalhados, saldoDia: minutosTrabalhados - 480 }
}

// outubro/2026: 05 e 12 são segundas-feiras, 06 e 13 terças, 07 quarta
const DIAS = [
  dia('2026-10-05', 360), // segunda
  dia('2026-10-06', 480), // terça
  dia('2026-10-07', 420), // quarta (semana de 05 a 11: 1260)
  dia('2026-10-12', 300), // segunda
  dia('2026-10-13', 600, 'INCONSISTENTE'), // terça (semana de 12 a 18: 900)
]

describe('calcularInsightsDoMes', () => {
  it('soma o total, conta os dias trabalhados e tira a média', () => {
    const insights = calcularInsightsDoMes(DIAS, [])

    expect(insights.totalMinutos).toBe(2160)
    expect(insights.diasTrabalhados).toBe(5)
    expect(insights.mediaMinutosPorDiaTrabalhado).toBe(432)
  })

  it('acha o dia em que mais trabalhou', () => {
    expect(calcularInsightsDoMes(DIAS, []).melhorDia).toEqual({ data: '2026-10-13', valor: 600 })
  })

  it('acha a semana (segunda a domingo) em que mais trabalhou', () => {
    expect(calcularInsightsDoMes(DIAS, []).melhorSemana).toEqual({ inicio: '2026-10-05', fim: '2026-10-11', valor: 1260 })
  })

  it('acha o dia da semana com a maior média de horas', () => {
    // terça: (480 + 600) / 2 = 540 | segunda: (360 + 300) / 2 = 330 | quarta: 420
    expect(calcularInsightsDoMes(DIAS, []).diaDaSemanaMaisProdutivo).toEqual({ diaDaSemana: 2, mediaMinutos: 540 })
  })

  it('conta os dias inconsistentes', () => {
    expect(calcularInsightsDoMes(DIAS, []).diasInconsistentes).toBe(1)
  })

  it('empate de dia fica com o mais antigo', () => {
    const insights = calcularInsightsDoMes([dia('2026-10-07', 400), dia('2026-10-06', 400)], [])

    expect(insights.melhorDia).toEqual({ data: '2026-10-06', valor: 400 })
  })

  it('agrupa as tarefas concluídas por dia e por semana', () => {
    const insights = calcularInsightsDoMes(DIAS, [
      '2026-10-06T14:00:00Z',
      '2026-10-06T18:30:00Z',
      '2026-10-07T10:00:00Z',
      '2026-10-13T10:00:00Z',
    ])

    expect(insights.tarefasConcluidas).toBe(4)
    expect(insights.melhorDiaTarefas).toEqual({ data: '2026-10-06', valor: 2 })
    expect(insights.melhorSemanaTarefas).toEqual({ inicio: '2026-10-05', fim: '2026-10-11', valor: 3 })
  })

  it('mês sem dados volta tudo vazio, sem quebrar', () => {
    expect(calcularInsightsDoMes([], [])).toEqual({
      totalMinutos: 0,
      diasTrabalhados: 0,
      mediaMinutosPorDiaTrabalhado: 0,
      melhorDia: null,
      melhorSemana: null,
      diaDaSemanaMaisProdutivo: null,
      diasInconsistentes: 0,
      tarefasConcluidas: 0,
      melhorDiaTarefas: null,
      melhorSemanaTarefas: null,
    })
  })

  it('dia sem minutos trabalhados não vira o melhor dia', () => {
    expect(calcularInsightsDoMes([dia('2026-10-05', 0)], []).melhorDia).toBeNull()
  })
})

describe('nomeDoDiaDaSemana', () => {
  it('0 é domingo e 6 é sábado', () => {
    expect(nomeDoDiaDaSemana(0)).toBe('domingo')
    expect(nomeDoDiaDaSemana(2)).toBe('terça-feira')
    expect(nomeDoDiaDaSemana(6)).toBe('sábado')
  })
})
