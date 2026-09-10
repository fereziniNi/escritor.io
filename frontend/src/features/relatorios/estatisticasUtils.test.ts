import { describe, expect, it } from 'vitest'
import { formatarFaixaDeHora, horaDePico, periodoPadrao } from './estatisticasUtils'

describe('horaDePico', () => {
  it('pedido do usuário: "horário que mais trabalhou" - acha o índice do maior valor', () => {
    const valores = new Array(24).fill(0)
    valores[9] = 30
    valores[14] = 90
    valores[15] = 40

    expect(horaDePico(valores)).toBe(14)
  })

  it('tudo zero (sem dado no período) retorna null, não a hora 0', () => {
    expect(horaDePico(new Array(24).fill(0))).toBeNull()
  })

  it('empate mantém o primeiro que aparece', () => {
    const valores = new Array(24).fill(0)
    valores[5] = 20
    valores[10] = 20

    expect(horaDePico(valores)).toBe(5)
  })
})

describe('formatarFaixaDeHora', () => {
  it('formata uma faixa de uma hora', () => {
    expect(formatarFaixaDeHora(14)).toBe('14h-15h')
  })

  it('vira a meia-noite sem virar hora negativa', () => {
    expect(formatarFaixaDeHora(23)).toBe('23h-0h')
  })
})

describe('periodoPadrao', () => {
  it('pedido do usuário: "sem usar o filtro" - início é o primeiro dia do mês corrente', () => {
    expect(periodoPadrao(new Date('2026-03-15T10:00:00Z')).inicio).toBe('2026-03-01')
  })

  it('fim é o dia SEGUINTE a hoje - "fim" é exclusivo no resto do sistema, hoje precisa entrar', () => {
    expect(periodoPadrao(new Date('2026-03-15T10:00:00Z')).fim).toBe('2026-03-16')
  })

  it('vira o mês sem quebrar (dia seguinte ao último dia do mês)', () => {
    expect(periodoPadrao(new Date('2026-03-31T10:00:00Z')).fim).toBe('2026-04-01')
  })

  it('vira o ano sem quebrar (dezembro)', () => {
    const periodo = periodoPadrao(new Date('2026-12-31T10:00:00Z'))
    expect(periodo.inicio).toBe('2026-12-01')
    expect(periodo.fim).toBe('2027-01-01')
  })
})
