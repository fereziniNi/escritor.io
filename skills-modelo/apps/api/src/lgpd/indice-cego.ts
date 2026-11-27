import { createHmac } from 'node:crypto';

/**
 * Índice cego: HMAC-SHA256 (chave `DADOS_CHAVE_INDICE`) do valor normalizado, em hex (64 caracteres). Permite buscar e
 * garantir unicidade ("já existe cliente com este CPF?") sem guardar o valor em claro. A coluna entra no HMAC, então o
 * mesmo CPF em tabelas diferentes não casa. Normalize ANTES (CPF: só dígitos), senão `123.456.789-09` e `12345678909`
 * dão índices diferentes.
 * Esta chave NÃO roda junto com as de dados: trocá-la exige recalcular todos os índices.
 */
export class IndiceCego {
  readonly #chave: Buffer;

  constructor(chave: Buffer) {
    this.#chave = chave;
  }

  calcular(valorNormalizado: string, coluna: string): string {
    return createHmac('sha256', this.#chave).update(`${coluna}\u0000${valorNormalizado}`, 'utf8').digest('hex');
  }
}
