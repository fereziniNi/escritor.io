import type { EstadoPresencaUsuario, Zona } from '../types'
import { zonaContendo } from './localizarZona'
import type { PosicaoTile } from './movimento'

const CAPACIDADE_CABINE = 1

/** Pedido do usuário: "Apenas uma pessoa deve entrar na cabine, Capacidade de 1 pessoa por
 * cabine" - usada só pra decidir se o MOVIMENTO é bloqueado (`construirBloqueioDeCapacidade`,
 * abaixo). Exclui quem já está dentro de propósito ("contando só quem não sou eu") - senão a
 * própria pessoa travaria tentando andar dentro da própria cabine, já que ela mesma contaria como
 * "gente lá dentro". Não usar pra decidir se a PORTA aparece fechada no desenho - ver
 * `cabineTemAlguemDentro`, que responde uma pergunta diferente.
 */
export function cabineEstaCheia(zona: Zona, usuarios: EstadoPresencaUsuario[], meuUsuarioId: number | null): boolean {
  const ocupantes = usuarios.filter(
    (usuario) => usuario.usuarioId !== meuUsuarioId && usuario.status !== 'OFFLINE' && zonaContendo([zona], usuario.x, usuario.y) !== null,
  )
  return ocupantes.length >= CAPACIDADE_CABINE
}

/** Pedido do usuário (depois de ver `cabineEstaCheia` em uso): "o usuário que entrou na sala
 * parece que a porta fica aberta, mas os outros veem fechada. Tem como fechar pra quem entra
 * também?" - `cabineEstaCheia` exclui "eu mesmo" de propósito (é a pergunta certa pro MOVIMENTO,
 * ver acima), mas errada pro DESENHO da porta: quem já está lá dentro nunca se via como "gente lá
 * dentro", então a porta ficava aberta só na tela de quem entrou. Esta função responde uma
 * pergunta diferente e sem depender de quem está olhando - "tem alguém aí dentro, seja quem for?"
 * - a mesma resposta pra todo mundo, o próprio ocupante incluso. Só usada por `CamadaMundo.tsx`
 * (desenho), nunca pelo bloqueio de movimento - o ocupante continua livre pra sair pela própria
 * porta mesmo com ela desenhada fechada (a colisão de verdade nunca dependeu do desenho). */
export function cabineTemAlguemDentro(zona: Zona, usuarios: EstadoPresencaUsuario[]): boolean {
  return usuarios.some((usuario) => usuario.status !== 'OFFLINE' && zonaContendo([zona], usuario.x, usuario.y) !== null)
}

/**
 * Bloqueia (silenciosamente, mesmo comportamento de esbarrar numa parede) qualquer movimento cujo
 * tile de destino caia dentro de uma cabine já cheia (`cabineEstaCheia`). Dinâmico por natureza -
 * depende de onde todo mundo está agora, não só da geometria da zona - por isso não mora em
 * `construirGradeColisao` (paredes são estáticas, recalculadas só quando o mapa muda, não a cada
 * passo de alguém).
 */
export function construirBloqueioDeCapacidade(
  cabines: Zona[],
  usuarios: EstadoPresencaUsuario[],
  meuUsuarioId: number | null,
): (de: PosicaoTile, para: PosicaoTile) => boolean {
  return function bloqueada(_de: PosicaoTile, para: PosicaoTile): boolean {
    const zonaAlvo = zonaContendo(cabines, para.x, para.y)
    if (!zonaAlvo) {
      return false
    }
    return cabineEstaCheia(zonaAlvo, usuarios, meuUsuarioId)
  }
}
