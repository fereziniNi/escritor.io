import { describe, expect, it } from 'vitest'
import { APARENCIA_PADRAO } from '../avatar/aparenciaAvatar'
import type { EstadoPresencaUsuario, StatusAvatar } from '../types'
import { construirBloqueioDeOcupacao } from './construirBloqueioDeOcupacao'

function usuario(usuarioId: number, x: number, y: number, status: StatusAvatar = 'DISPONIVEL'): EstadoPresencaUsuario {
  return { usuarioId, nome: `Usuário ${usuarioId}`, x, y, status, aparencia: APARENCIA_PADRAO }
}

describe('construirBloqueioDeOcupacao', () => {
  it('pedido do usuário: "não deixe nenhum ficar em cima um do outro não importa o lugar" - bloqueia entrar num tile já ocupado, em qualquer lugar do mapa', () => {
    const usuarios = [usuario(1, 5, 5)]
    const bloqueada = construirBloqueioDeOcupacao(usuarios, 2) // "eu" sou o usuário 2

    expect(bloqueada({ x: 4, y: 5 }, { x: 5, y: 5 })).toBe(true)
  })

  it('não bloqueia um tile vazio', () => {
    const bloqueada = construirBloqueioDeOcupacao([], 2)

    expect(bloqueada({ x: 4, y: 5 }, { x: 5, y: 5 })).toBe(false)
  })

  it('não bloqueia a própria pessoa de "entrar" no próprio tile (primeiro passo de qualquer movimento)', () => {
    const usuarios = [usuario(1, 5, 5)]
    const bloqueada = construirBloqueioDeOcupacao(usuarios, 1) // "eu" sou o usuário 1, já ali

    expect(bloqueada({ x: 5, y: 5 }, { x: 5, y: 5 })).toBe(false)
  })

  it('ocupante OFFLINE não conta - não tem ninguém de verdade parado ali', () => {
    const usuarios = [usuario(1, 5, 5, 'OFFLINE')]
    const bloqueada = construirBloqueioDeOcupacao(usuarios, 2)

    expect(bloqueada({ x: 4, y: 5 }, { x: 5, y: 5 })).toBe(false)
  })

  it('gente em outro tile não bloqueia', () => {
    const usuarios = [usuario(1, 9, 9)]
    const bloqueada = construirBloqueioDeOcupacao(usuarios, 2)

    expect(bloqueada({ x: 4, y: 5 }, { x: 5, y: 5 })).toBe(false)
  })

  it('vale em qualquer parte do mapa, não só dentro de uma sala - funciona sem depender de zona nenhuma', () => {
    const usuarios = [usuario(1, 0, 0)]
    const bloqueada = construirBloqueioDeOcupacao(usuarios, 2)

    expect(bloqueada({ x: 1, y: 0 }, { x: 0, y: 0 })).toBe(true)
  })
})
