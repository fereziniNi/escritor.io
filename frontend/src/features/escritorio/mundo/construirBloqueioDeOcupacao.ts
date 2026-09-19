import type { EstadoPresencaUsuario } from '../types'
import type { PosicaoTile } from './movimento'

/**
 * Pedido do usuário: "não deixe nenhum ficar em cima um do outro não importa o lugar" - diferente
 * de `construirBloqueioDeCapacidade` (só dentro de cabines, no máximo 1 pessoa), este bloqueio
 * vale pro mapa inteiro: o tile de destino não pode já estar ocupado por outra pessoa, em lugar
 * nenhum (corredor, sala, cabine - qualquer tile). Mesmo raciocínio das outras checagens de
 * ocupação já existentes: exclui "eu mesmo" (senão o meu próprio tile atual bloquearia o primeiro
 * passo de qualquer movimento) e exclui quem está OFFLINE (não tem ninguém de verdade parado ali -
 * ver `cabineEstaCheia`/`calcularParesProximos`, mesma regra).
 *
 * Bloqueio só do lado do cliente (cortesia visual, mesmo espírito de paredes/capacidade de
 * cabine) - o servidor (`ValidadorPosicaoMapa`) continua só validando os limites do mapa, não
 * ocupação de tile. Duas pessoas confirmando o mesmo tile vazio ao mesmo tempo (corrida de rede)
 * pode gerar uma sobreposição breve até a próxima atualização chegar - limitação aceita, mesma
 * categoria das outras colisões client-side já existentes.
 */
export function construirBloqueioDeOcupacao(
  usuarios: EstadoPresencaUsuario[],
  meuUsuarioId: number | null,
): (de: PosicaoTile, para: PosicaoTile) => boolean {
  return function bloqueada(_de: PosicaoTile, para: PosicaoTile): boolean {
    return usuarios.some(
      (usuario) =>
        usuario.usuarioId !== meuUsuarioId && usuario.status !== 'OFFLINE' && usuario.x === para.x && usuario.y === para.y,
    )
  }
}
