import { type CookieOptions } from 'express';
import { type Config } from '../config/config';
import { modoDesenvolvimento } from './regras-auth';

/** Nome do cookie em produção. O prefixo `__Host-` obriga o navegador a exigir Secure, Path=/ e nenhum Domain. */
export const COOKIE_SESSAO_PRODUCAO = '__Host-sessao';
/** Nome fora de produção: em http://localhost alguns navegadores (Safari) recusam cookie Secure e `__Host-`. */
export const COOKIE_SESSAO_DESENVOLVIMENTO = 'sessao';

/**
 * Nome e atributos do cookie de sessão. Por padrão (produção, e também NODE_ENV ausente) SEMPRE `__Host-sessao` com
 * HttpOnly, Secure, SameSite=Lax e Path=/ (sem Domain, sem `req.secure` no meio: proxy mal configurado não derruba o
 * Secure). Só com NODE_ENV=development ou test DECLARADOS muda o nome e tira o Secure, para o login funcionar em
 * http://localhost em qualquer navegador (falha fechada: esquecer a variável nunca afrouxa o cookie).
 */
export function cookieSessao(config: Config): { nome: string; opcoes: CookieOptions } {
  const producao = !modoDesenvolvimento(config);
  return {
    nome: producao ? COOKIE_SESSAO_PRODUCAO : COOKIE_SESSAO_DESENVOLVIMENTO,
    opcoes: { httpOnly: true, secure: producao, sameSite: 'lax', path: '/' },
  };
}

/** Valor do cookie `nome` no cabeçalho Cookie (sem cookie-parser). Ausente, vazio ou malformado: undefined. */
export function lerCookie(cabecalho: string | undefined, nome: string): string | undefined {
  if (!cabecalho) return undefined;
  for (const parte of cabecalho.split(';')) {
    const igual = parte.indexOf('=');
    if (igual < 0 || parte.slice(0, igual).trim() !== nome) continue;
    try {
      return decodeURIComponent(parte.slice(igual + 1).trim()) || undefined;
    } catch {
      return undefined;
    }
  }
  return undefined;
}
