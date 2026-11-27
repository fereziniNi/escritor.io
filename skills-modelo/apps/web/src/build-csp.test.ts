// @vitest-environment node
// O build da web tem de funcionar sob a CSP do Caddy (deploy/caddy/seguranca.caddy): script só de arquivo do próprio
// sistema (nenhum <script> inline) e fonte só de arquivo (font-src 'self', sem data:font embutida pelo Vite).
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { build } from 'vite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

describe('build da web compatível com a CSP', () => {
  let saida: string;

  beforeAll(async () => {
    saida = mkdtempSync(path.join(tmpdir(), 'web-csp-'));
    await build({
      configFile: path.resolve(import.meta.dirname, '..', 'vite.config.ts'),
      root: path.resolve(import.meta.dirname, '..'),
      logLevel: 'silent',
      build: { outDir: saida, emptyOutDir: true },
    });
  }, 120_000);

  afterAll(() => rmSync(saida, { recursive: true, force: true }));

  it('index.html sem script inline (script-src \'self\')', () => {
    const html = readFileSync(path.join(saida, 'index.html'), 'utf8');
    const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)];
    expect(scripts.length).toBeGreaterThan(0);
    for (const [, atributos, corpo] of scripts) {
      expect(atributos).toMatch(/\bsrc="\//);
      expect(corpo!.trim()).toBe('');
    }
  });

  it('nenhuma fonte embutida como data: no CSS (font-src \'self\')', () => {
    const css = readdirSync(path.join(saida, 'assets')).filter((a) => a.endsWith('.css'));
    expect(css.length).toBeGreaterThan(0);
    for (const arquivo of css) {
      const embutidas = readFileSync(path.join(saida, 'assets', arquivo), 'utf8').match(/data:font\/[a-z0-9]+/g) ?? [];
      expect(embutidas).toEqual([]);
    }
  });

  it('nenhum código que a CSP bloqueia sem unsafe-eval (eval / new Function)', () => {
    const js = readdirSync(path.join(saida, 'assets')).filter((a) => a.endsWith('.js'));
    for (const arquivo of js) {
      const proibidos = readFileSync(path.join(saida, 'assets', arquivo), 'utf8').match(/\beval\(|new Function\(/g) ?? [];
      expect(proibidos).toEqual([]);
    }
  });
});
