// origem: skills-modelo/apps/api/src/usuarios/papel.spec.ts
import { PAPEIS as PAPEIS_DOS_CONTRATOS } from 'contratos';
import { describe, expect, it } from 'vitest';
import { PAPEIS, ehPapel } from './papel';

describe('papéis', () => {
  it('a API e a web (pacote contratos) têm exatamente os mesmos papéis, na mesma ordem', () => {
    expect([...PAPEIS]).toEqual([...PAPEIS_DOS_CONTRATOS]);
  });

  it('ehPapel compara por igualdade exata', () => {
    expect(ehPapel('ADMIN')).toBe(true);
    expect(ehPapel('admin')).toBe(false);
    expect(ehPapel(' ADMIN')).toBe(false);
    expect(ehPapel(undefined)).toBe(false);
  });
});
