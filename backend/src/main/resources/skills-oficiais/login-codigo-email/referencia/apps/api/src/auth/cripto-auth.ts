// origem: skills-modelo/apps/api/src/auth/cripto-auth.ts
import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';

/** 0..999999 -> "000000".."999999" (zeros à esquerda: o código sempre tem 6 dígitos). */
export const codigoComZeros = (n: number): string => n.toString().padStart(6, '0');

/** Código de acesso de 6 dígitos sorteado pelo gerador criptográfico (`crypto.randomInt`, nunca `Math.random`). */
export const gerarCodigo = (): string => codigoComZeros(randomInt(0, 1_000_000));

/**
 * HMAC-SHA256 do código, ligado ao e-mail, em hex. É o único jeito de o código ir para o banco: quem lê o banco
 * (backup, réplica, consulta) não consegue entrar, e o mesmo código em outro e-mail dá outro HMAC.
 */
export const hmacCodigo = (segredo: string, email: string, codigo: string): string =>
  createHmac('sha256', segredo).update(`${email}\u0000${codigo}`).digest('hex');

/** Compara dois HMAC em tempo constante (`timingSafeEqual`); tamanhos diferentes são falsos sem atalho. */
export function hmacIguais(a: string, b: string): boolean {
  const x = Buffer.from(a, 'utf8');
  const y = Buffer.from(b, 'utf8');
  if (x.length !== y.length) {
    timingSafeEqual(x, x);
    return false;
  }
  return timingSafeEqual(x, y);
}

/** Token opaco da sessão: `randomBytes(32)` em base64url. Vai só no cookie; o banco guarda o `hashToken`. */
export const novoToken = (): string => randomBytes(32).toString('base64url');

/** SHA-256 do token, em hex: é o que fica na coluna `sessao.hash_token`. */
export const hashToken = (token: string): string => createHash('sha256').update(token, 'utf8').digest('hex');
