import { type NextFunction, type Request, type Response } from 'express';

const ehApi = (caminho: string) => caminho === '/api' || caminho.startsWith('/api/');

/**
 * Cabeçalhos de segurança de toda resposta da aplicação (API e SPA servido por ela). O Caddy repete os mesmos e
 * acrescenta a CSP do SPA (deploy/caddy/seguranca.caddy). Na /api:
 * - CSP "nada": a API só devolve JSON e arquivos, nunca página com script;
 * - Cache-Control no-store: resposta com dado de cliente não fica em cache de navegador nem de proxy (uma rota pode
 *   sobrescrever, ex.: download público com cache).
 * O SPA mantém o próprio cache (index.html no-cache, /assets imutável) e recebe a CSP do Caddy.
 * HSTS (1 ano) só quando a requisição chegou por HTTPS (req.secure; atrás do Caddy depende de PROXIES_CONFIAVEIS).
 */
export function cabecalhosSeguranca(req: Request, res: Response, next: NextFunction): void {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()');
  if (ehApi(req.path)) {
    res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'");
    res.setHeader('Cache-Control', 'no-store');
  }
  if (req.secure) res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
}
