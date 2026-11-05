// origem: skills-modelo/apps/api/src/seguranca/origem.guard.spec.ts
import { type ExecutionContext, ForbiddenException } from '@nestjs/common';
import { type Request } from 'express';
import { describe, expect, it } from 'vitest';
import { type Config, carregarConfig } from '../config/config';
import { MesmaOrigemGuard, getDeOutroSite, origemRecusada } from './origem.guard';

const PROPRIA = 'https://sistema.exemplo.com.br';
const LISTA = ['https://painel.grupomultiplica.com.br'];

/** Requisição falsa: só o que o guard lê (método, cabeçalhos, protocolo e host). */
function req(method: string, headers: Record<string, string> = {}): Request {
  const h = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
  return { method, protocol: 'https', get: (nome: string) => (nome.toLowerCase() === 'host' ? 'sistema.exemplo.com.br' : h[nome.toLowerCase()]) } as unknown as Request;
}

describe('origemRecusada (CSRF em métodos que alteram estado)', () => {
  it('GET, HEAD e OPTIONS nunca são recusados por aqui', () => {
    for (const m of ['GET', 'HEAD', 'OPTIONS']) expect(origemRecusada(req(m, { origin: 'https://malicioso.exemplo' }), [])).toBe(false);
  });

  it('POST, PUT, PATCH e DELETE da própria origem ou da lista de CORS passam', () => {
    for (const m of ['POST', 'PUT', 'PATCH', 'DELETE']) expect(origemRecusada(req(m, { origin: PROPRIA }), [])).toBe(false);
    expect(origemRecusada(req('POST', { origin: LISTA[0]! }), LISTA)).toBe(false);
    expect(origemRecusada(req('POST', { referer: `${PROPRIA}/clientes?x=1` }), [])).toBe(false);
  });

  it('origem de outro site, "null" ou Referer de outro site são recusados', () => {
    expect(origemRecusada(req('POST', { origin: 'https://malicioso.exemplo' }), LISTA)).toBe(true);
    expect(origemRecusada(req('DELETE', { origin: 'null' }), [])).toBe(true);
    expect(origemRecusada(req('PUT', { referer: 'https://malicioso.exemplo/pagina' }), [])).toBe(true);
    // Mesmo host em outro esquema ou porta é outra origem.
    expect(origemRecusada(req('POST', { origin: 'http://sistema.exemplo.com.br' }), [])).toBe(true);
    expect(origemRecusada(req('POST', { origin: 'https://sistema.exemplo.com.br:8443' }), [])).toBe(true);
  });

  it('Origin vale mais que Referer: Origin de fora com Referer da casa é recusado', () => {
    expect(origemRecusada(req('POST', { origin: 'https://malicioso.exemplo', referer: `${PROPRIA}/` }), [])).toBe(true);
  });

  it('sem Origin e sem Referer: navegador de outro site (Sec-Fetch-Site) é recusado; cliente que não é navegador passa', () => {
    expect(origemRecusada(req('POST', { 'sec-fetch-site': 'cross-site' }), [])).toBe(true);
    expect(origemRecusada(req('POST', { 'sec-fetch-site': 'same-site' }), [])).toBe(true);
    expect(origemRecusada(req('POST', { 'sec-fetch-site': 'same-origin' }), [])).toBe(false);
    expect(origemRecusada(req('POST'), [])).toBe(false);
  });
});

describe('getDeOutroSite (GET com efeito, @MesmaOrigem)', () => {
  it('o próprio front (same-origin), endereço digitado (none) e cliente sem Sec-Fetch-Site passam', () => {
    expect(getDeOutroSite(req('GET', { 'sec-fetch-site': 'same-origin' }), [])).toBe(false);
    expect(getDeOutroSite(req('GET', { 'sec-fetch-site': 'none' }), [])).toBe(false);
    expect(getDeOutroSite(req('GET'), [])).toBe(false);
  });

  it('navegação ou fetch de outro site é recusado, salvo Origin da lista de CORS', () => {
    expect(getDeOutroSite(req('GET', { 'sec-fetch-site': 'cross-site' }), LISTA)).toBe(true);
    expect(getDeOutroSite(req('GET', { 'sec-fetch-site': 'same-site' }), LISTA)).toBe(true);
    expect(getDeOutroSite(req('GET', { 'sec-fetch-site': 'cross-site', origin: 'https://malicioso.exemplo' }), LISTA)).toBe(true);
    expect(getDeOutroSite(req('GET', { 'sec-fetch-site': 'same-site', origin: LISTA[0]! }), LISTA)).toBe(false);
  });
});

describe('MesmaOrigemGuard', () => {
  const config: Config = carregarConfig({ DATABASE_URL: 'postgres://app:x@localhost:5432/app', CORS_ORIGENS: LISTA[0] });
  const contexto = (r: Request) => ({ switchToHttp: () => ({ getRequest: () => r }) }) as unknown as ExecutionContext;

  it('recusa com 403 o GET vindo de outro site e deixa passar o do próprio sistema', () => {
    const guard = new MesmaOrigemGuard(config);
    expect(() => guard.canActivate(contexto(req('GET', { 'sec-fetch-site': 'cross-site' })))).toThrow(ForbiddenException);
    expect(guard.canActivate(contexto(req('GET', { 'sec-fetch-site': 'same-origin' })))).toBe(true);
  });
});
