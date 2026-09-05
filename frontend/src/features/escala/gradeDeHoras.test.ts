import { describe, expect, it } from 'vitest'
import { HORA_FIM_GRADE, HORA_INICIO_GRADE, TOTAL_SLOTS, horaParaSlot, slotParaHora } from './gradeDeHoras'

describe('gradeDeHoras', () => {
  it('o início da grade é o slot 0', () => {
    expect(horaParaSlot(`0${HORA_INICIO_GRADE}:00`)).toBe(0)
    expect(slotParaHora(0)).toBe(`0${HORA_INICIO_GRADE}:00`)
  })

  it('o fim da grade é o último slot', () => {
    expect(horaParaSlot(`${HORA_FIM_GRADE}:00`)).toBe(TOTAL_SLOTS)
  })

  it('meio-dia cai no slot certo', () => {
    expect(slotParaHora(horaParaSlot('12:00'))).toBe('12:00')
    expect(slotParaHora(horaParaSlot('12:30'))).toBe('12:30')
  })

  it('arredonda pro slot de 30min mais próximo', () => {
    expect(slotParaHora(horaParaSlot('12:10'))).toBe('12:00')
    expect(slotParaHora(horaParaSlot('12:20'))).toBe('12:30')
  })

  it('nunca sai do intervalo [0, TOTAL_SLOTS] mesmo com horário fora da grade', () => {
    expect(horaParaSlot('00:00')).toBe(0)
    expect(horaParaSlot('23:59')).toBe(TOTAL_SLOTS)
  })
})
