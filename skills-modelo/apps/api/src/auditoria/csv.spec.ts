import { describe, expect, it } from 'vitest';
import { BOM, celulaCsv, montarCsv } from './csv';

describe('CSV da auditoria', () => {
  it('começa com BOM UTF-8, separa por ponto e vírgula e termina cada linha com CRLF', () => {
    const csv = montarCsv(['a', 'b'], [['1', 'x'], ['2', null]]);
    expect(csv.startsWith(BOM)).toBe(true);
    expect(csv).toBe(`${BOM}a;b\r\n1;x\r\n2;\r\n`);
  });

  it('põe entre aspas o que tem ponto e vírgula, aspas ou quebra de linha, e dobra as aspas', () => {
    expect(celulaCsv('a;b')).toBe('"a;b"');
    expect(celulaCsv('ele disse "oi"')).toBe('"ele disse ""oi"""');
    expect(celulaCsv('linha1\nlinha2')).toBe('"linha1\nlinha2"');
    expect(celulaCsv('simples')).toBe('simples');
  });

  it('neutraliza fórmula de planilha (= + - @ tab CR no começo) com apóstrofo', () => {
    for (const perigo of ['=1+1', '+cmd', '-2', '@SOMA(A1)', '\tx', '\rx']) {
      expect(celulaCsv(perigo).replace(/^"/, '').startsWith("'")).toBe(true);
    }
  });

  it('números e nulos', () => {
    expect(celulaCsv(12)).toBe('12');
    expect(celulaCsv(null)).toBe('');
    expect(celulaCsv(undefined)).toBe('');
  });
});
