import { describe, expect, it } from 'vitest'
import { formatarEstado, formatarMinutos, formatarSaldo } from './formatarMinutos'

describe('formatarMinutos', () => {
  it('formata horas e minutos com dois dígitos', () => {
    expect(formatarMinutos(540)).toBe('9h00')
    expect(formatarMinutos(63)).toBe('1h03')
    expect(formatarMinutos(0)).toBe('0h00')
  })
})

describe('formatarSaldo', () => {
  it('usa sinal de mais pra saldo positivo ou zero', () => {
    expect(formatarSaldo(60)).toBe('+1h00')
    expect(formatarSaldo(0)).toBe('+0h00')
  })

  it('usa sinal de menos pra saldo negativo, sem duplicar em formatarMinutos', () => {
    expect(formatarSaldo(-300)).toBe('-5h00')
    expect(formatarSaldo(-45)).toBe('-0h45')
  })
})

describe('formatarEstado', () => {
  it('traduz os estados conhecidos', () => {
    expect(formatarEstado('ABERTA')).toBe('Em andamento')
    expect(formatarEstado('FECHADA')).toBe('Fechada')
    expect(formatarEstado('INCONSISTENTE')).toBe('Inconsistente')
  })
})
