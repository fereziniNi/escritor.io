import { describe, expect, it } from 'vitest'
import { formatarDuracao } from './formatarDuracao'

describe('formatarDuracao', () => {
  it('menos de um minuto mostra 00:SS', () => {
    expect(formatarDuracao(45)).toBe('00:45')
  })

  it('minutos e segundos formatam como MM:SS', () => {
    expect(formatarDuracao(125)).toBe('02:05')
  })

  it('uma hora ou mais formata como H:MM:SS', () => {
    expect(formatarDuracao(3661)).toBe('1:01:01')
  })

  it('duração zero mostra 00:00', () => {
    expect(formatarDuracao(0)).toBe('00:00')
  })

  it('duração negativa (relógio do cliente atrasado) nunca mostra número negativo', () => {
    expect(formatarDuracao(-5)).toBe('00:00')
  })
})
