import { randomBytes } from 'node:crypto';
import { Logger } from '@nestjs/common';
import { type Config } from '../config/config';

/** Valores fixos do Padrão Multiplica para o login por código. Mudar algum é decisão de segurança, não de gosto. */
export const VALIDADE_CODIGO_MIN = 10;
export const MAX_TENTATIVAS_POR_CODIGO = 5;
export const MAX_PEDIDOS_POR_EMAIL = 3;
export const JANELA_PEDIDOS_MIN = 10;
/** Resposta de pedir código e de entrar nunca sai antes disto (o tempo não revela se o e-mail existe). */
export const TEMPO_MINIMO_RESPOSTA_MS = 600;
/** Último uso da sessão é regravado no máximo uma vez por minuto (não escreve no banco a cada requisição). */
export const INTERVALO_TOQUE_SESSAO_S = 60;

/**
 * E-mail dentro de AUTH_DOMINIOS_PERMITIDOS? Domínio EXATO depois do último @ (nunca "termina com": um
 * `endsWith('grupomultiplica.com.br')` aceitaria `x@malgrupomultiplica.com.br`). Lista vazia: qualquer domínio, e quem
 * decide é a tabela usuario.
 */
export function dominioPermitido(email: string, dominios: readonly string[]): boolean {
  const arroba = email.lastIndexOf('@');
  if (arroba < 1) return false;
  return dominios.length === 0 || dominios.includes(email.slice(arroba + 1));
}

/**
 * Segredo do HMAC dos códigos. Em produção AUTH_SEGREDO_CODIGO é obrigatório (a API não sobe sem ele: todas as
 * instâncias precisam do mesmo). Fora de produção, se faltar, gera um aleatório por processo: os códigos pendentes
 * deixam de valer quando a API reinicia, o que em desenvolvimento não faz falta.
 */
export function segredoDoCodigo(config: Config): string {
  const definido = config.AUTH_SEGREDO_CODIGO?.revelar();
  if (definido !== undefined) return definido;
  if (config.NODE_ENV === 'production') {
    throw new Error('AUTH_SEGREDO_CODIGO (ou AUTH_SEGREDO_CODIGO_ARQUIVO) é obrigatória em produção');
  }
  new Logger('Auth').warn('AUTH_SEGREDO_CODIGO ausente: usando segredo aleatório deste processo (só fora de produção)');
  return randomBytes(32).toString('hex');
}

const dormir = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, Math.max(0, ms)));

/**
 * Executa `trabalho` e só devolve (ou lança) depois de `ms` desde o início. Assim e-mail inexistente, fora do domínio,
 * com limite estourado ou válido demoram o mesmo para quem está do lado de fora.
 */
export async function comTempoMinimo<T>(ms: number, trabalho: () => Promise<T>): Promise<T> {
  const inicio = performance.now();
  try {
    return await trabalho();
  } finally {
    await dormir(inicio + ms - performance.now());
  }
}
