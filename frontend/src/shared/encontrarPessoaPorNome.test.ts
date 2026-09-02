import { describe, expect, it } from 'vitest'
import { encontrarPessoaPorNome, existeSugestaoPara } from './encontrarPessoaPorNome'

const PESSOAS = [
  { id: 1, nome: 'Ana Souza' },
  { id: 2, nome: 'Beto Lima' },
]

describe('encontrarPessoaPorNome', () => {
  it('encontra a pessoa pelo nome exato', () => {
    expect(encontrarPessoaPorNome(PESSOAS, 'Beto Lima')).toEqual({ id: 2, nome: 'Beto Lima' })
  })

  it('ignora maiúsculas/minúsculas', () => {
    expect(encontrarPessoaPorNome(PESSOAS, 'ana souza')).toEqual({ id: 1, nome: 'Ana Souza' })
  })

  it('ignora espaço nas pontas', () => {
    expect(encontrarPessoaPorNome(PESSOAS, '  Beto Lima  ')).toEqual({ id: 2, nome: 'Beto Lima' })
  })

  it('retorna null pra nome vazio', () => {
    expect(encontrarPessoaPorNome(PESSOAS, '')).toBeNull()
    expect(encontrarPessoaPorNome(PESSOAS, '   ')).toBeNull()
  })

  it('retorna null pra nome que não bate com nenhuma pessoa', () => {
    expect(encontrarPessoaPorNome(PESSOAS, 'Alguém que não existe')).toBeNull()
  })

  it('não faz match parcial - "Ana" sozinho não encontra "Ana Souza"', () => {
    expect(encontrarPessoaPorNome(PESSOAS, 'Ana')).toBeNull()
  })
})

describe('existeSugestaoPara', () => {
  it('é permissivo com nome parcial - "b" ainda é candidato a "Beto Lima"', () => {
    expect(existeSugestaoPara(PESSOAS, 'b')).toBe(true)
  })

  it('considera nome vazio como "ainda não é erro"', () => {
    expect(existeSugestaoPara(PESSOAS, '')).toBe(true)
    expect(existeSugestaoPara(PESSOAS, '   ')).toBe(true)
  })

  it('só fica falso quando nenhuma pessoa bate nem parcialmente', () => {
    expect(existeSugestaoPara(PESSOAS, 'Alguém que não existe')).toBe(false)
  })

  it('ignora maiúsculas/minúsculas, igual encontrarPessoaPorNome', () => {
    expect(existeSugestaoPara(PESSOAS, 'BETO')).toBe(true)
  })
})
