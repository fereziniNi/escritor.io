// origem: skills-modelo/apps/api/test/seguranca.e2e.spec.ts
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { type INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { carregarConfig } from '../src/config/config';
import { criarApp } from '../src/criar-app';
import { subirPostgres } from './postgres';

const MALICIOSO = 'https://malicioso.exemplo';
const PAINEL = 'https://painel.exemplo.com.br';

let url: string;
let parar: () => Promise<void>;
const apps: INestApplication[] = [];

/** Sobe uma API com o banco de teste e as variáveis pedidas (cada describe testa uma configuração). */
async function subirApi(extra: Record<string, string> = {}): Promise<INestApplication> {
  const config = carregarConfig({ DATABASE_URL: url, NODE_ENV: 'test', LOG_LEVEL: 'silent', ...extra });
  const app = await criarApp(config);
  await app.init();
  apps.push(app);
  return app;
}

beforeAll(async () => {
  ({ url, parar } = await subirPostgres());
});

afterAll(async () => {
  for (const app of apps) await app.close();
  await parar?.();
});

describe('cabeçalhos de segurança', () => {
  let app: INestApplication;
  let webDist: string;

  beforeAll(async () => {
    webDist = mkdtempSync(path.join(tmpdir(), 'web-dist-'));
    writeFileSync(path.join(webDist, 'index.html'), '<!doctype html><html><body>SPA</body></html>');
    app = await subirApi({ WEB_DIST: webDist });
  });

  afterAll(() => rmSync(webDist, { recursive: true, force: true }));

  it('GET /api/health traz todos os cabeçalhos de segurança', async () => {
    const res = await request(app.getHttpServer()).get('/api/health').expect(200);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('DENY');
    expect(res.headers['referrer-policy']).toBe('no-referrer');
    expect(res.headers['cross-origin-opener-policy']).toBe('same-origin');
    expect(res.headers['cross-origin-resource-policy']).toBe('same-origin');
    expect(res.headers['permissions-policy']).toBe('camera=(), microphone=(), geolocation=(), payment=(), usb=()');
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.headers['content-security-policy']).toBe("default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'");
  });

  it('não anuncia o framework (sem X-Powered-By)', async () => {
    const res = await request(app.getHttpServer()).get('/api/health');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('HSTS só quando a requisição chegou por HTTPS; X-Forwarded-Proto sem proxy confiável é ignorado', async () => {
    const http = await request(app.getHttpServer()).get('/api/health');
    expect(http.headers['strict-transport-security']).toBeUndefined();
    const forjado = await request(app.getHttpServer()).get('/api/health').set('X-Forwarded-Proto', 'https');
    expect(forjado.headers['strict-transport-security']).toBeUndefined();
  });

  it('erro da API (404) também leva os cabeçalhos', async () => {
    const res = await request(app.getHttpServer()).get('/api/nao-existe').expect(404);
    expect(res.headers['x-frame-options']).toBe('DENY');
    expect(res.headers['cache-control']).toBe('no-store');
  });

  it('o SPA servido pela API leva os cabeçalhos, mas não o no-store (o index.html é no-cache)', async () => {
    const res = await request(app.getHttpServer()).get('/clientes/42').expect(200);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('DENY');
    expect(res.headers['cache-control']).toBe('no-cache');
    // A CSP do SPA vem do Caddy (deploy/caddy/seguranca.caddy); a da API (default-src 'none') quebraria a tela.
    expect(res.headers['content-security-policy']).toBeUndefined();
  });
});

describe('atrás do Caddy (PROXIES_CONFIAVEIS=1)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await subirApi({ PROXIES_CONFIAVEIS: '1' });
  });

  it('HTTPS informado pelo proxy liga o HSTS de 1 ano', async () => {
    const res = await request(app.getHttpServer()).get('/api/health').set('X-Forwarded-Proto', 'https');
    expect(res.headers['strict-transport-security']).toBe('max-age=31536000; includeSubDomains');
  });

  it('POST da própria origem pública (https, informada pelo proxy) não é recusado', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/health')
      .set('Host', 'sistema.exemplo.com.br')
      .set('X-Forwarded-Proto', 'https')
      .set('Origin', 'https://sistema.exemplo.com.br');
    expect(res.status).not.toBe(403);
  });
});

describe('CSRF: origem da requisição', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await subirApi();
  });

  it('POST com Origin de outro site → 403 em JSON padrão', async () => {
    const res = await request(app.getHttpServer()).post('/api/health').set('Origin', MALICIOSO).expect(403);
    expect(res.body).toMatchObject({ status: 403 });
    expect(res.headers['x-request-id']).toBeDefined();
  });

  it('DELETE com Referer de outro site e sem Origin → 403', async () => {
    await request(app.getHttpServer()).delete('/api/qualquer').set('Referer', `${MALICIOSO}/pagina`).expect(403);
  });

  it('POST com Origin "null" (iframe sandbox, data:) → 403', async () => {
    await request(app.getHttpServer()).post('/api/health').set('Origin', 'null').expect(403);
  });

  it('POST da própria origem segue para a rota (aqui, 404 por não existir POST /api/health)', async () => {
    const res = await request(app.getHttpServer()).post('/api/health').set('Host', 'sistema.exemplo.com.br').set('Origin', 'http://sistema.exemplo.com.br');
    expect(res.status).toBe(404);
  });

  it('GET com Origin de outro site não é bloqueado por esta regra (só métodos que alteram estado)', async () => {
    await request(app.getHttpServer()).get('/api/health').set('Origin', MALICIOSO).expect(200);
  });
});

describe('CORS', () => {
  it('sem CORS_ORIGENS, nenhuma origem recebe Access-Control-Allow-Origin', async () => {
    const app = await subirApi();
    const res = await request(app.getHttpServer()).get('/api/health').set('Origin', PAINEL);
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  describe('com CORS_ORIGENS', () => {
    let app: INestApplication;

    beforeAll(async () => {
      app = await subirApi({ CORS_ORIGENS: PAINEL });
    });

    it('origem listada recebe Access-Control-Allow-Origin com credenciais', async () => {
      const res = await request(app.getHttpServer()).get('/api/health').set('Origin', PAINEL).expect(200);
      expect(res.headers['access-control-allow-origin']).toBe(PAINEL);
      expect(res.headers['access-control-allow-credentials']).toBe('true');
    });

    it('origem não listada: resposta sem Access-Control-Allow-Origin e nunca 500', async () => {
      const res = await request(app.getHttpServer()).get('/api/health').set('Origin', MALICIOSO);
      expect(res.status).not.toBe(500);
      expect(res.headers['access-control-allow-origin']).toBeUndefined();
    });

    it('preflight (OPTIONS) de origem não listada: sem Access-Control-Allow-Origin e nunca 500', async () => {
      const res = await request(app.getHttpServer())
        .options('/api/health')
        .set('Origin', MALICIOSO)
        .set('Access-Control-Request-Method', 'POST');
      expect(res.status).toBeLessThan(500);
      expect(res.headers['access-control-allow-origin']).toBeUndefined();
    });

    it('POST de origem listada passa pela checagem de origem (CSRF)', async () => {
      const res = await request(app.getHttpServer()).post('/api/health').set('Origin', PAINEL);
      expect(res.status).not.toBe(403);
    });
  });
});

describe('limite de requisições por IP', () => {
  it('6ª requisição acima do limite de 5 → 429 com Retry-After, no formato padrão de erro', async () => {
    const app = await subirApi({ LIMITE_REQ_POR_IP: '5' });
    for (let i = 0; i < 5; i++) await request(app.getHttpServer()).get('/api/health').expect(200);
    const res = await request(app.getHttpServer()).get('/api/health').expect(429);
    expect(Number(res.headers['retry-after'])).toBeGreaterThan(0);
    expect(res.body).toMatchObject({ status: 429 });
    expect(res.headers['x-request-id']).toBeDefined();
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  it('atrás do proxy, cada IP real (X-Forwarded-For) tem o seu contador; sem proxy confiável o cabeçalho é ignorado', async () => {
    const comProxy = await subirApi({ LIMITE_REQ_POR_IP: '2', PROXIES_CONFIAVEIS: '1' });
    const pedir = (app: INestApplication, ip: string) => request(app.getHttpServer()).get('/api/health').set('X-Forwarded-For', ip);
    await pedir(comProxy, '203.0.113.10').expect(200);
    await pedir(comProxy, '203.0.113.10').expect(200);
    await pedir(comProxy, '203.0.113.10').expect(429);
    await pedir(comProxy, '203.0.113.11').expect(200);

    const semProxy = await subirApi({ LIMITE_REQ_POR_IP: '2' });
    await pedir(semProxy, '203.0.113.20').expect(200);
    await pedir(semProxy, '203.0.113.21').expect(200);
    // Trocar o X-Forwarded-For não escapa do limite quando não há proxy confiável.
    await pedir(semProxy, '203.0.113.22').expect(429);
  });
});
