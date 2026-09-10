import { describe, expect, it } from 'vitest'
import { formatarEstado, formatarMinutos, formatarSaldo } from './formatarMinutos'

describe('formatarMinutos', () => {
  it('pedido do usuário: "horas menor que 1 hora em minutos" - abaixo de 1h, só minutos, nunca "0hXX"', () => {
    expect(formatarMinutos(52)).toBe('52 min')
    expect(formatarMinutos(1)).toBe('1 min')
    expect(formatarMinutos(0)).toBe('0 min')
  })

  it('a partir de 1h, horas e minutos por extenso ("1h03min", não "1h03")', () => {
    expect(formatarMinutos(63)).toBe('1h03min')
    expect(formatarMinutos(270)).toBe('4h30min')
  })

  it('hora exata não carrega "00min" à toa', () => {
    expect(formatarMinutos(60)).toBe('1h')
    expect(formatarMinutos(540)).toBe('9h')
  })
})

describe('formatarSaldo', () => {
  it('usa sinal de mais pra saldo positivo ou zero', () => {
    expect(formatarSaldo(60)).toBe('+1h')
    expect(formatarSaldo(0)).toBe('+0 min')
  })

  it('usa sinal de menos pra saldo negativo, sem duplicar em formatarMinutos', () => {
    expect(formatarSaldo(-300)).toBe('-5h')
    expect(formatarSaldo(-45)).toBe('-45 min')
  })
})

describe('formatarEstado', () => {
  it('traduz os estados conhecidos', () => {
    expect(formatarEstado('ABERTA')).toBe('Em andamento')
    expect(formatarEstado('FECHADA')).toBe('Fechada')
    expect(formatarEstado('INCONSISTENTE')).toBe('Inconsistente')
  })
})
