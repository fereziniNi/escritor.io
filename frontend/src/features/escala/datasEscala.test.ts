import { describe, expect, it } from 'vitest'
import { abreviacaoDoDiaDaSemana, anoDaData, diaDaData, mesDaData, segundaFeiraDaSemana, somarDias } from './datasEscala'

describe('datasEscala', () => {
  it('segundaFeiraDaSemana acha a segunda mesmo quando a data já é domingo', () => {
    // 2026-01-04 é um domingo (2026-01-01 é quinta, confirmado no construirGradeDoMes.test.ts)
    expect(segundaFeiraDaSemana(2026, 1, 4)).toBe('2025-12-29')
  })

  it('segundaFeiraDaSemana retorna a própria data quando já é segunda', () => {
    expect(segundaFeiraDaSemana(2025, 12, 29)).toBe('2025-12-29')
  })

  it('somarDias vira o mês', () => {
    expect(somarDias('2026-01-30', 3)).toBe('2026-02-02')
  })

  it('somarDias vira o ano', () => {
    expect(somarDias('2026-12-30', 3)).toBe('2027-01-02')
  })

  it('somarDias aceita quantidade negativa', () => {
    expect(somarDias('2026-01-02', -3)).toBe('2025-12-30')
  })

  it('abreviacaoDoDiaDaSemana calcula pelo dia real, não por posição num array', () => {
    // 2026-09-05 é um sábado - pego pela verificação visual: `CalendarioDia` reusa
    // `CalendarioSemana` com um array de 1 dia só, então usar o índice do array (sempre 0) pra
    // decidir a abreviação sempre dava "Seg", mesmo num sábado.
    expect(abreviacaoDoDiaDaSemana('2026-09-05')).toBe('Sáb')
    expect(abreviacaoDoDiaDaSemana('2026-09-07')).toBe('Seg')
    expect(abreviacaoDoDiaDaSemana('2026-09-13')).toBe('Dom')
  })

  it('extrai ano/mês/dia de uma data ISO', () => {
    expect(anoDaData('2026-03-07')).toBe(2026)
    expect(mesDaData('2026-03-07')).toBe(3)
    expect(diaDaData('2026-03-07')).toBe(7)
  })
})
