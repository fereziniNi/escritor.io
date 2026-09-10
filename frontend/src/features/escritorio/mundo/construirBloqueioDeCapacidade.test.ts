import { describe, expect, it } from 'vitest'
import { APARENCIA_PADRAO } from '../avatar/aparenciaAvatar'
import type { EstadoPresencaUsuario, StatusAvatar, Zona } from '../types'
import { cabineEstaCheia, cabineTemAlguemDentro, construirBloqueioDeCapacidade } from './construirBloqueioDeCapacidade'

function usuario(usuarioId: number, x: number, y: number, status: StatusAvatar = 'DISPONIVEL'): EstadoPresencaUsuario {
  return { usuarioId, nome: `Usuário ${usuarioId}`, x, y, status, aparencia: APARENCIA_PADRAO }
}

const CABINE_1: Zona = { id: 1, nome: 'Cabine 1', x: 0, y: 0, largura: 3, altura: 3, tipo: 'CABINE' }
const CABINE_2: Zona = { id: 2, nome: 'Cabine 2', x: 10, y: 0, largura: 3, altura: 3, tipo: 'CABINE' }

describe('construirBloqueioDeCapacidade', () => {
  it('pedido do usuário: "capacidade de 1 pessoa por cabine" - bloqueia entrar numa cabine que já tem alguém', () => {
    const usuarios = [usuario(1, 1, 1)] // já dentro da Cabine 1
    const bloqueada = construirBloqueioDeCapacidade([CABINE_1, CABINE_2], usuarios, 2) // "eu" sou o usuário 2

    expect(bloqueada({ x: 3, y: 1 }, { x: 2, y: 1 })).toBe(true) // entrando na Cabine 1 por fora
  })

  it('não bloqueia entrar numa cabine vazia', () => {
    const bloqueada = construirBloqueioDeCapacidade([CABINE_1, CABINE_2], [], 2)

    expect(bloqueada({ x: 3, y: 1 }, { x: 2, y: 1 })).toBe(false)
  })

  it('não bloqueia a própria pessoa que já está lá dentro de andar dentro da própria cabine', () => {
    const usuarios = [usuario(1, 1, 1)]
    const bloqueada = construirBloqueioDeCapacidade([CABINE_1, CABINE_2], usuarios, 1) // "eu" sou o usuário 1, já dentro

    expect(bloqueada({ x: 1, y: 1 }, { x: 2, y: 1 })).toBe(false)
  })

  it('ocupante OFFLINE não conta como estar de verdade dentro da cabine', () => {
    const usuarios = [usuario(1, 1, 1, 'OFFLINE')]
    const bloqueada = construirBloqueioDeCapacidade([CABINE_1, CABINE_2], usuarios, 2)

    expect(bloqueada({ x: 3, y: 1 }, { x: 2, y: 1 })).toBe(false)
  })

  it('cada cabine é independente - gente na Cabine 1 não bloqueia entrar na Cabine 2', () => {
    const usuarios = [usuario(1, 1, 1)] // dentro da Cabine 1
    const bloqueada = construirBloqueioDeCapacidade([CABINE_1, CABINE_2], usuarios, 2)

    expect(bloqueada({ x: 13, y: 1 }, { x: 12, y: 1 })).toBe(false) // entrando na Cabine 2
  })

  it('não bloqueia movimento fora de qualquer cabine', () => {
    const bloqueada = construirBloqueioDeCapacidade([CABINE_1, CABINE_2], [], 2)

    expect(bloqueada({ x: 20, y: 20 }, { x: 21, y: 20 })).toBe(false)
  })
})

describe('cabineEstaCheia', () => {
  // usada só pelo bloqueio de MOVIMENTO (`construirBloqueioDeCapacidade`, describe acima) -
  // exclui "eu mesmo" de propósito, senão a própria pessoa travaria tentando andar dentro da
  // própria cabine.
  it('cheia quando já tem alguém dentro (contando só quem não sou eu)', () => {
    const usuarios = [usuario(1, 1, 1)]
    expect(cabineEstaCheia(CABINE_1, usuarios, 2)).toBe(true)
  })

  it('não está cheia pra quem já está dentro dela mesma', () => {
    const usuarios = [usuario(1, 1, 1)]
    expect(cabineEstaCheia(CABINE_1, usuarios, 1)).toBe(false)
  })

  it('não está cheia quando vazia', () => {
    expect(cabineEstaCheia(CABINE_1, [], 2)).toBe(false)
  })

  it('ocupante OFFLINE não conta', () => {
    const usuarios = [usuario(1, 1, 1, 'OFFLINE')]
    expect(cabineEstaCheia(CABINE_1, usuarios, 2)).toBe(false)
  })

  it('gente numa cabine diferente não conta', () => {
    const usuarios = [usuario(1, 11, 1)] // dentro da Cabine 2, não da 1
    expect(cabineEstaCheia(CABINE_1, usuarios, 2)).toBe(false)
  })
})

describe('cabineTemAlguemDentro', () => {
  // pedido do usuário: "o usuário que entrou... a porta fica aberta, mas os outros veem
  // fechada. Tem como fechar pra quem entra também?" - `CamadaMundo.tsx` usa isso (não
  // `cabineEstaCheia`) pra decidir se desenha a porta fechada - sem excluir "eu mesmo", pra
  // fechar igual na tela de todo mundo, o próprio ocupante incluso.
  it('tem gente dentro mesmo do ponto de vista de quem já está lá (sem excluir "eu mesmo")', () => {
    const usuarios = [usuario(1, 1, 1)]
    expect(cabineTemAlguemDentro(CABINE_1, usuarios)).toBe(true) // inclusive pro próprio usuário 1
  })

  it('vazia continua vazia pra qualquer um', () => {
    expect(cabineTemAlguemDentro(CABINE_1, [])).toBe(false)
  })

  it('ocupante OFFLINE não conta', () => {
    const usuarios = [usuario(1, 1, 1, 'OFFLINE')]
    expect(cabineTemAlguemDentro(CABINE_1, usuarios)).toBe(false)
  })

  it('gente numa cabine diferente não conta', () => {
    const usuarios = [usuario(1, 11, 1)] // dentro da Cabine 2, não da 1
    expect(cabineTemAlguemDentro(CABINE_1, usuarios)).toBe(false)
  })
})
