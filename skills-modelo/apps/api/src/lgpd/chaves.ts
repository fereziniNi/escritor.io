import { randomBytes } from 'node:crypto';
import { Logger } from '@nestjs/common';
import { type Config } from '../config/config';
import { Chaveiro, lerChaveIndice, lerChavesDados } from './chaveiro';
import { IndiceCego } from './indice-cego';

/** Token de injeção: `@Inject(CHAVES_LGPD) chaves: ChavesLgpd` (provido pelo LgpdModule, global). */
export const CHAVES_LGPD = Symbol('CHAVES_LGPD');

export interface ChavesLgpd {
  chaveiro: Chaveiro;
  indice: IndiceCego;
}

/**
 * Chaves da criptografia de campo e do índice cego, a partir da config (já validadas no carregarConfig: 32 bytes, kids
 * únicos, índice diferente das de dados). FALHA FECHADA, como o segredo do login: sem `DADOS_CHAVES` e
 * `DADOS_CHAVE_INDICE` a API não sobe, salvo com `NODE_ENV` development ou test DECLARADOS (o valor cru); aí usa chaves
 * aleatórias deste processo e o que for cifrado deixa de abrir quando a API reinicia (em dev, gere as chaves uma vez e
 * ponha no .env).
 */
export function carregarChavesLgpd(config: Config): ChavesLgpd {
  const dados = config.DADOS_CHAVES?.revelar();
  const indice = config.DADOS_CHAVE_INDICE?.revelar();
  if (dados !== undefined && indice !== undefined) {
    return { chaveiro: new Chaveiro(lerChavesDados(dados)), indice: new IndiceCego(lerChaveIndice(indice)) };
  }
  if (config.NODE_ENV_DECLARADO !== 'development' && config.NODE_ENV_DECLARADO !== 'test') {
    throw new Error(
      'DADOS_CHAVES e DADOS_CHAVE_INDICE (ou *_ARQUIVO) são obrigatórias fora de desenvolvimento: sem elas o CPF não pode ' +
        'ser cifrado. (NODE_ENV ausente conta como produção; em dev declare NODE_ENV=development.)',
    );
  }
  new Logger('Lgpd').warn('DADOS_CHAVES ausente: chaves aleatórias deste processo (só dev/teste; o que for cifrado não abre depois de reiniciar)');
  return {
    chaveiro: new Chaveiro([{ kid: 'efemera', chave: randomBytes(32) }]),
    indice: new IndiceCego(randomBytes(32)),
  };
}
