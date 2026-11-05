// origem: skills-modelo/apps/web/src/tema/tema.test.ts
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CHAVE_TEMA, alternarTema, aplicarTema, temaEfetivo } from './tema';

const lerArquivo = (...partes: string[]) => readFileSync(path.resolve(import.meta.dirname, '..', '..', ...partes), 'utf8');

describe('tokens.css', () => {
  const css = lerArquivo('src', 'tema', 'tokens.css');

  it('traz as cores de marca do padrão', () => {
    expect(css).toContain('--primaria: #2F6FED');
    expect(css).toContain('--navy: #001A33');
    expect(css).toContain('--ciano: #00E1FF');
  });

  it('traz o modo escuro por escolha e pelo sistema (quando não há escolha)', () => {
    expect(css).toContain(':root[data-theme="dark"]');
    expect(css).toMatch(/@media \(prefers-color-scheme: dark\)\s*{\s*:root:not\(\[data-theme="light"\]\)/);
    expect(css).toContain('--fundo: #0B1120');
    expect(css).toContain('--primaria: #5B8DEF');
    expect(css).toContain('--navy: #000E1C');
  });

  it('liga as variáveis do shadcn aos tokens (nunca cor solta)', () => {
    expect(css).toContain('--primary: var(--primaria)');
    expect(css).toContain('--background: var(--fundo)');
    expect(css).toContain('--destructive: var(--perigo)');
  });
});

describe('troca de tema', () => {
  beforeEach(() => {
    localStorage.clear();
    delete document.documentElement.dataset['theme'];
  });
  afterEach(() => localStorage.clear());

  it('aplicarTema grava multiplica:tema e seta data-theme', () => {
    aplicarTema('escuro');
    expect(CHAVE_TEMA).toBe('multiplica:tema');
    expect(localStorage.getItem('multiplica:tema')).toBe('escuro');
    expect(document.documentElement.dataset['theme']).toBe('dark');
    aplicarTema('claro');
    expect(localStorage.getItem('multiplica:tema')).toBe('claro');
    expect(document.documentElement.dataset['theme']).toBe('light');
  });

  it('alternarTema inverte o tema efetivo e devolve o novo', () => {
    aplicarTema('claro');
    expect(alternarTema()).toBe('escuro');
    expect(document.documentElement.dataset['theme']).toBe('dark');
    expect(alternarTema()).toBe('claro');
  });

  it('sem escolha salva, o tema efetivo é claro quando o sistema não informa preferência', () => {
    expect(temaEfetivo()).toBe('claro');
  });

  it('public/tema-inicial.js aplica o tema salvo antes da pintura', () => {
    const script = lerArquivo('public', 'tema-inicial.js');
    localStorage.setItem('multiplica:tema', 'escuro');
    new Function(script)();
    expect(document.documentElement.dataset['theme']).toBe('dark');
    localStorage.setItem('multiplica:tema', 'claro');
    new Function(script)();
    expect(document.documentElement.dataset['theme']).toBe('light');
  });
});
