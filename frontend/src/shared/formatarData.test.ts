import { describe, expect, it } from 'vitest'
import { formatarDataBr, formatarDataHoraBr, formatarTempoRelativo } from './formatarData'

describe('formatarDataBr', () => {
  it('formata uma data pura (AAAA-MM-DD) como DD/MM/AAAA', () => {
    expect(formatarDataBr('2026-01-05')).toBe('05/01/2026')
  })

  it('formata um instante ISO completo, ignorando a hora', () => {
    expect(formatarDataBr('2026-12-31T23:59:59Z')).toBe('31/12/2026')
  })

  it('não sofre desvio de fuso horário em datas no início do ano', () => {
    expect(formatarDataBr('2026-01-01')).toBe('01/01/2026')
  })
})

describe('formatarDataHoraBr', () => {
  // Monta o esperado com o mesmo `Date` local usado pela função - propositalmente não hardcoda um
  // horário fixo (ex.: "06:00"), porque o fuso da máquina que roda o teste (dev/CI) não é
  // garantido; o que se testa aqui é o formato (padding, ordem dos campos), não um fuso específico.
  function esperado(instanteIso: string): string {
    const data = new Date(instanteIso)
    const dia = String(data.getDate()).padStart(2, '0')
    const mes = String(data.getMonth() + 1).padStart(2, '0')
    const horas = String(data.getHours()).padStart(2, '0')
    const minutos = String(data.getMinutes()).padStart(2, '0')
    return `${dia}/${mes}/${data.getFullYear()} ${horas}:${minutos}`
  }

  it('formata um instante ISO como DD/MM/AAAA HH:mm no fuso local', () => {
    const instante = '2026-01-15T09:05:00Z'
    expect(formatarDataHoraBr(instante)).toBe(esperado(instante))
  })

  it('preenche hora e minuto com zero à esquerda', () => {
    const instante = '2026-03-02T01:07:00Z'
    expect(formatarDataHoraBr(instante)).toBe(esperado(instante))
  })
})

describe('formatarTempoRelativo', () => {
  const AGORA = new Date('2026-01-15T12:00:00Z')

  it('pedido do usuário: "ver as últimas que chegaram no sistema" - "agora" pra menos de 1 minuto', () => {
    expect(formatarTempoRelativo('2026-01-15T11:59:30Z', AGORA)).toBe('agora')
  })

  it('minutos', () => {
    expect(formatarTempoRelativo('2026-01-15T11:55:00Z', AGORA)).toBe('há 5 min')
  })

  it('horas', () => {
    expect(formatarTempoRelativo('2026-01-15T10:00:00Z', AGORA)).toBe('há 2h')
  })

  it('dias, com plural', () => {
    expect(formatarTempoRelativo('2026-01-13T12:00:00Z', AGORA)).toBe('há 2 dias')
  })

  it('um dia só, sem plural', () => {
    expect(formatarTempoRelativo('2026-01-14T12:00:00Z', AGORA)).toBe('há 1 dia')
  })

  it('depois de uma semana, cai pra data/hora completa', () => {
    expect(formatarTempoRelativo('2026-01-07T09:05:00Z', AGORA)).toBe(formatarDataHoraBr('2026-01-07T09:05:00Z'))
  })
})
