// origem: skills-modelo/apps/api/src/auth/regras-auth.ts
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
 * Falha fechada: o login só relaxa (cookie sem Secure, segredo gerado na hora) quando NODE_ENV=development ou test foi
 * DECLARADO no ambiente. NODE_ENV ausente ou vazio (contêiner que esqueceu a variável) é tratado como produção.
 */
export const modoDesenvolvimento = (config: Config): boolean =>
  config.NODE_ENV_DECLARADO === 'development' || config.NODE_ENV_DECLARADO === 'test';

/** Mensagem do aviso de boot quando NODE_ENV não está definido (null quando está). */
export function avisoNodeEnv(config: Config): string | null {
  if (config.NODE_ENV_DECLARADO !== undefined) return null;
  return (
    'NODE_ENV NÃO DEFINIDO: o login funciona como em produção (cookie __Host-sessao com Secure, só em https, e ' +
    'AUTH_SEGREDO_CODIGO obrigatória). Em desenvolvimento defina NODE_ENV=development no .env; na imagem, NODE_ENV=production.'
  );
}

/**
 * Segredo do HMAC dos códigos. Obrigatório (a API não sobe sem ele; todas as instâncias precisam do mesmo), salvo com
 * NODE_ENV=development ou test declarados: aí, se faltar, gera um aleatório por processo e os códigos pendentes deixam
 * de valer quando a API reinicia. Trocar o segredo invalida só os códigos pendentes (até 10 min); sessões continuam.
 */
export function segredoDoCodigo(config: Config): string {
  const definido = config.AUTH_SEGREDO_CODIGO?.revelar();
  if (definido !== undefined) return definido;
  if (!modoDesenvolvimento(config)) {
    throw new Error(
      'AUTH_SEGREDO_CODIGO (ou AUTH_SEGREDO_CODIGO_ARQUIVO) é obrigatória fora de desenvolvimento ' +
        '(NODE_ENV ausente conta como produção; em dev declare NODE_ENV=development)',
    );
  }
  new Logger('Auth').warn('AUTH_SEGREDO_CODIGO ausente: usando segredo aleatório deste processo (só em desenvolvimento e testes)');
  return randomBytes(32).toString('hex');
}

const dormir = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, Math.max(0, ms)));

/**
 * Executa `trabalho` e só devolve (ou lança) depois de `ms` desde o início. Assim e-mail inexistente, fora do domínio,
 * com limite estourado ou válido demoram o mesmo para quem está do lado de fora.
 * Limite conhecido: é um PISO, não um tempo fixo. Se o trabalho passar de `ms` (banco lento, ou espera na trava do
 * e-mail quando há pedidos simultâneos para o MESMO endereço) a resposta demora mais. Em uso normal o trabalho leva
 * poucos milissegundos; a espera na trava só acontece para quem já sabe qual e-mail está pedindo.
 */
export async function comTempoMinimo<T>(ms: number, trabalho: () => Promise<T>): Promise<T> {
  const inicio = performance.now();
  try {
    return await trabalho();
  } finally {
    await dormir(inicio + ms - performance.now());
  }
}
