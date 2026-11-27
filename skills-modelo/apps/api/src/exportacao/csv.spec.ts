import { describe, expect, it } from 'vitest';
import { BOM, celulaCsv, montarCsv, paraCsv } from './csv';
import { type RelatorioTabular } from './relatorio-tabular';

describe('CSV (montarCsv e celulaCsv)', () => {
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
    for (const perigo of ['=1+1', '+SOMA(A1)', '-2+3', '@SOMA(A1)', '\tx', '\rx']) {
      expect(celulaCsv(perigo).replace(/^"/, '').startsWith("'")).toBe(true);
    }
  });

  it('números e nulos', () => {
    expect(celulaCsv(12)).toBe('12');
    expect(celulaCsv(null)).toBe('');
    expect(celulaCsv(undefined)).toBe('');
  });
});

const relatorio: RelatorioTabular = {
  titulo: 'Vendas de março',
  colunas: [
    { chave: 'nome', titulo: 'Nome', tipo: 'texto' },
    { chave: 'valor', titulo: 'Valor (R$)', tipo: 'moeda' },
    { chave: 'qtd', titulo: 'Quantidade', tipo: 'numero' },
    { chave: 'taxa', titulo: 'Taxa', tipo: 'percentual' },
    { chave: 'dia', titulo: 'Dia', tipo: 'data' },
  ],
  linhas: [
    { nome: 'Ação & Cia; "ç"', valor: 1234.5, qtd: 1500, taxa: 0.125, dia: '2026-03-05' },
    { nome: '=HYPERLINK("http://mal.exemplo.com")', valor: 0, qtd: 2.5, taxa: 0, dia: '2026-03-31' },
    { nome: 'Sem dados', valor: null, qtd: undefined, taxa: null, dia: null },
  ],
  totais: { valor: 1234.5 },
};

describe('paraCsv', () => {
  const texto = paraCsv(relatorio).toString('utf8');
  const linhas = texto.slice(1).split('\r\n');

  it('devolve Buffer que começa com BOM UTF-8 e usa ponto e vírgula', () => {
    const b = paraCsv(relatorio);
    expect(Buffer.isBuffer(b)).toBe(true);
    expect([...b.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    expect(linhas[0]).toBe('Nome;Valor (R$);Quantidade;Taxa;Dia');
  });

  it('formata no padrão brasileiro: decimal com vírgula, sem separador de milhar, data dd/mm/aaaa, percentual com %', () => {
    expect(linhas[1]).toBe('"Ação & Cia; ""ç""";1234,50;1500;12,50%;05/03/2026');
    expect(linhas[2]).toContain(';0,00;2,5;0,00%;31/03/2026');
  });

  it('célula vazia para nulo e linha de totais ao final', () => {
    expect(linhas[3]).toBe('Sem dados;;;;');
    expect(linhas[4]).toBe('Total;1234,50;;;');
  });

  it('neutraliza fórmula nas células de texto', () => {
    expect(linhas[2]!.startsWith(`"'=HYPERLINK(""http://mal.exemplo.com"")"`)).toBe(true);
  });
});
