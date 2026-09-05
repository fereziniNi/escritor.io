import { describe, expect, it } from 'vitest'
import { construirGradeDoMes } from './construirGradeDoMes'

describe('construirGradeDoMes', () => {
  it('preenche o início da semana com dias do mês anterior (janeiro/2026 começa numa quinta)', () => {
    const grade = construirGradeDoMes(2026, 1)

    // semana começa na segunda - quinta é o 4º dia, então 3 dias de dezembro entram antes
    expect(grade.slice(0, 3)).toEqual([
      { data: '2025-12-29', dia: 29, noMesAtual: false },
      { data: '2025-12-30', dia: 30, noMesAtual: false },
      { data: '2025-12-31', dia: 31, noMesAtual: false },
    ])
  })

  it('lista todos os 31 dias de janeiro/2026 marcados como do mês atual', () => {
    const grade = construirGradeDoMes(2026, 1)
    const diasDoMes = grade.filter((dia) => dia.noMesAtual)

    expect(diasDoMes).toHaveLength(31)
    expect(diasDoMes[0]).toEqual({ data: '2026-01-01', dia: 1, noMesAtual: true })
    expect(diasDoMes[30]).toEqual({ data: '2026-01-31', dia: 31, noMesAtual: true })
  })

  it('completa o fim da grade com dias do mês seguinte pra fechar a última semana', () => {
    const grade = construirGradeDoMes(2026, 1)

    expect(grade.at(-1)).toEqual({ data: '2026-02-01', dia: 1, noMesAtual: false })
  })

  it('sempre gera um número de dias múltiplo de 7 (semanas completas)', () => {
    for (let mes = 1; mes <= 12; mes++) {
      expect(construirGradeDoMes(2026, mes).length % 7).toBe(0)
    }
  })

  it('considera fevereiro bissexto (2024) com 29 dias', () => {
    const grade = construirGradeDoMes(2024, 2)
    const diasDoMes = grade.filter((dia) => dia.noMesAtual)

    expect(diasDoMes).toHaveLength(29)
    expect(diasDoMes.at(-1)).toEqual({ data: '2024-02-29', dia: 29, noMesAtual: true })
  })

  it('considera fevereiro não bissexto (2026) com 28 dias', () => {
    const grade = construirGradeDoMes(2026, 2)
    const diasDoMes = grade.filter((dia) => dia.noMesAtual)

    expect(diasDoMes).toHaveLength(28)
  })

  it('vira o ano corretamente (dezembro -> janeiro)', () => {
    const grade = construirGradeDoMes(2026, 12)

    expect(grade.at(-1)?.data.startsWith('2027-01')).toBe(true)
  })
})
