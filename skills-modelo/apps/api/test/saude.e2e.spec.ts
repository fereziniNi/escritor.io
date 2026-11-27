import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Writable } from 'node:stream';
import { type INestApplication } from '@nestjs/common';
import { esquemaRespostaSaude } from 'contratos';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { carregarConfig } from '../src/config/config';
import { criarApp } from '../src/criar-app';
import { subirPostgres } from './postgres';

/** Guarda as linhas JSON do pino para conferir o que foi logado. */
function coletorDeLogs() {
  const linhas: Record<string, unknown>[] = [];
  const destino = new Writable({
    write(chunk: Buffer, _enc, cb) {
      for (const l of chunk.toString('utf8').split('\n').filter(Boolean)) linhas.push(JSON.parse(l) as Record<string, unknown>);
      cb();
    },
  });
  return { linhas, destino };
}

describe('saúde, 404 da API e request-id (e2e)', () => {
  let app: INestApplication;
  let parar: () => Promise<void>;
  let webDist: string;
  const logs = coletorDeLogs();

  beforeAll(async () => {
    const pg = await subirPostgres();
    parar = pg.parar;
    // SPA de mentira: a API serve o build da web, mas /api/* nunca cai nele.
    webDist = mkdtempSync(path.join(tmpdir(), 'web-dist-'));
    writeFileSync(path.join(webDist, 'index.html'), '<!doctype html><html><body>SPA</body></html>');
    const config = carregarConfig({
      DATABASE_URL: pg.url,
      NODE_ENV: 'test',
      LOG_LEVEL: 'info',
      APP_VERSAO: '1.2.3',
      APP_COMMIT: 'abc1234',
      WEB_DIST: webDist,
    });
    app = await criarApp(config, { destinoLog: logs.destino });
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
    await parar?.();
    rmSync(webDist, { recursive: true, force: true });
  });

  it('GET /api/health responde status, banco, versão e commit', async () => {
    const res = await request(app.getHttpServer()).get('/api/health').expect(200);
    expect(esquemaRespostaSaude.parse(res.body)).toEqual({ status: 'ok', banco: 'ok', versao: '1.2.3', commit: 'abc1234' });
  });

  it('/api/nao-existe responde 404 em JSON, nunca o index.html do SPA', async () => {
    const res = await request(app.getHttpServer()).get('/api/nao-existe').set('Accept', 'text/html').expect(404);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(res.text).not.toContain('<html');
    expect(res.body).toMatchObject({ status: 404 });
  });

  it('rota da web (fora de /api) devolve o index.html do SPA', async () => {
    const res = await request(app.getHttpServer()).get('/clientes/42').expect(200);
    expect(res.headers['content-type']).toMatch(/text\/html/);
    expect(res.text).toContain('SPA');
  });

  it('arquivo estático inexistente responde 404, não o index.html', async () => {
    await request(app.getHttpServer()).get('/assets/nao-existe.js').expect(404);
  });

  it('gera X-Request-Id quando ausente e devolve no header', async () => {
    const res = await request(app.getHttpServer()).get('/api/health');
    expect(res.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('reaproveita X-Request-Id válido recebido e loga a requisição com ele', async () => {
    const id = 'req-teste-12345678';
    const res = await request(app.getHttpServer()).get('/api/health').set('X-Request-Id', id);
    expect(res.headers['x-request-id']).toBe(id);
    const linha = logs.linhas.find((l) => (l['req'] as { id?: string } | undefined)?.id === id);
    expect(linha).toBeDefined();
    expect(linha!['res']).toEqual({ statusCode: 200 });
  });

  it('troca X-Request-Id com formato estranho por um gerado', async () => {
    const res = await request(app.getHttpServer()).get('/api/health').set('X-Request-Id', 'x y<script>');
    expect(res.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe('saúde com o banco fora do ar (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    // Porta 1 do localhost: conexão recusada na hora.
    const config = carregarConfig({ DATABASE_URL: 'postgres://app:x@127.0.0.1:1/app', NODE_ENV: 'test', LOG_LEVEL: 'silent' });
    app = await criarApp(config);
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('GET /api/health responde 503 com banco "erro"', async () => {
    const res = await request(app.getHttpServer()).get('/api/health').expect(503);
    expect(res.body).toMatchObject({ status: 'erro', banco: 'erro' });
  });
});
