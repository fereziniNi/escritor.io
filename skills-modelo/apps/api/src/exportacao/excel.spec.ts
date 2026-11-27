import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { paraExcel } from './excel';
import { type RelatorioTabular } from './relatorio-tabular';

const relatorio: RelatorioTabular = {
  titulo: 'Vendas: março/2026 [teste]',
  colunas: [
    { chave: 'nome', titulo: 'Nome', tipo: 'texto' },
    { chave: 'valor', titulo: 'Valor', tipo: 'moeda' },
    { chave: 'qtd', titulo: 'Quantidade', tipo: 'numero' },
    { chave: 'taxa', titulo: 'Taxa', tipo: 'percentual' },
    { chave: 'dia', titulo: 'Dia', tipo: 'data' },
  ],
  linhas: [
    { nome: 'Ação', valor: 1234.5, qtd: 3, taxa: 0.125, dia: '2026-03-05' },
    { nome: '=1+1', valor: 10, qtd: 2.5, taxa: 0.5, dia: '2026-03-31' },
  ],
  totais: { valor: 1244.5 },
};

async function ler(r: RelatorioTabular = relatorio) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load((await paraExcel(r, { nomeSistema: 'Sistema Exemplo' })) as unknown as ArrayBuffer);
  const aba = wb.worksheets[0]!;
  let cabecalho = 0;
  aba.eachRow((linha, n) => {
    if (cabecalho === 0 && linha.getCell(1).value === 'Nome') cabecalho = n;
  });
  return { wb, aba, cabecalho };
}

describe('paraExcel', () => {
  it('gera um .xlsx (zip) legível', async () => {
    const buf = await paraExcel(relatorio);
    expect(buf.subarray(0, 2).toString('latin1')).toBe('PK');
    const { wb } = await ler();
    expect(wb.worksheets).toHaveLength(1);
  });

  it('nome da aba sem os caracteres proibidos e com até 31 caracteres', async () => {
    const { aba } = await ler();
    expect(aba.name).not.toMatch(/[\\/?*[\]:]/);
    expect(aba.name.length).toBeLessThanOrEqual(31);
  });

  it('coluna de moeda lida de volta tem o formato R$ #,##0.00 e valor numérico', async () => {
    const { aba, cabecalho } = await ler();
    const celula = aba.getRow(cabecalho + 1).getCell(2);
    expect(celula.value).toBe(1234.5);
    expect(celula.numFmt).toBe('R$ #,##0.00');
  });

  it('formatos de número, percentual e data; data é data de verdade', async () => {
    const { aba, cabecalho } = await ler();
    const l1 = aba.getRow(cabecalho + 1);
    const l2 = aba.getRow(cabecalho + 2);
    expect(l1.getCell(3).numFmt).toBe('#,##0');
    expect(l2.getCell(3).numFmt).toBe('#,##0.00');
    expect(l1.getCell(4).numFmt).toBe('0.00%');
    expect(l1.getCell(5).numFmt).toBe('dd/mm/yyyy');
    expect((l1.getCell(5).value as Date).toISOString().slice(0, 10)).toBe('2026-03-05');
  });

  it('cabeçalho com a cor primária (#2F6FED) e letra branca em negrito', async () => {
    const { aba, cabecalho } = await ler();
    const c = aba.getRow(cabecalho).getCell(1);
    expect((c.fill as ExcelJS.FillPattern).fgColor?.argb).toBe('FF2F6FED');
    expect(c.font?.bold).toBe(true);
    expect(c.font?.color?.argb).toBe('FFFFFFFF');
  });

  it('texto que parece fórmula fica como texto literal, sem apóstrofo, e não é fórmula', async () => {
    const { aba, cabecalho } = await ler();
    const c = aba.getRow(cabecalho + 2).getCell(1);
    expect(c.value).toBe('=1+1');
    expect(c.type).toBe(ExcelJS.ValueType.String);
    expect(c.formula).toBeUndefined();
  });

  it('linha de totais depois dos dados e nome do sistema no topo', async () => {
    const { aba, cabecalho } = await ler();
    const t = aba.getRow(cabecalho + 3);
    expect(t.getCell(1).value).toBe('Total');
    expect(t.getCell(2).value).toBe(1244.5);
    expect(aba.getCell(1, 1).value).toBe('Sistema Exemplo');
  });
});
