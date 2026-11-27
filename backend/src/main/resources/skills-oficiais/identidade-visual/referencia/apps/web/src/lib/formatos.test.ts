// origem: skills-modelo/apps/web/src/lib/formatos.test.ts
import { describe, expect, it } from 'vitest';
import { formatarCnpj, formatarCpf, formatarData, formatarMoeda } from './formatos';

describe('formatarMoeda', () => {
  it('usa R$, ponto de milhar e vírgula decimal', () => {
    expect(formatarMoeda(1250000)).toBe('R$ 1.250.000,00');
    expect(formatarMoeda(0.5)).toBe('R$ 0,50');
    expect(formatarMoeda(-1234.5)).toBe('-R$ 1.234,50');
  });
});

describe('formatarData', () => {
  it('data pura (AAAA-MM-DD) não muda de dia por fuso', () => {
    expect(formatarData('2026-11-05')).toBe('05/11/2026');
  });
  it('instante é mostrado no horário de Brasília', () => {
    expect(formatarData('2026-11-05T01:30:00Z')).toBe('04/11/2026');
    expect(formatarData(new Date('2026-11-05T15:00:00Z'))).toBe('05/11/2026');
  });
  it('valor vazio ou inválido vira traço', () => {
    expect(formatarData(null)).toBe('—');
    expect(formatarData('lixo')).toBe('—');
  });
});

describe('formatarCpf e formatarCnpj', () => {
  it('formata só dígitos', () => {
    expect(formatarCpf('12345678909')).toBe('123.456.789-09');
    expect(formatarCnpj('11222333000181')).toBe('11.222.333/0001-81');
  });
  it('aceita entrada já formatada', () => {
    expect(formatarCpf('123.456.789-09')).toBe('123.456.789-09');
    expect(formatarCnpj('11.222.333/0001-81')).toBe('11.222.333/0001-81');
  });
  it('tamanho errado volta como veio (não inventa dígitos)', () => {
    expect(formatarCpf('123')).toBe('123');
    expect(formatarCnpj('123')).toBe('123');
  });
});
