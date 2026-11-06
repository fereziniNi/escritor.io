// origem: skills-modelo/apps/api/src/exportacao/excel.ts
import ExcelJS from 'exceljs';
import { COR } from '../email/modelo-email';
import { agoraBrasilia, lerDia, lerNumero, neutralizarFormula, textoDe } from './formato';
import { IDENTIDADE_PADRAO, type IdentidadeExportacao, type RelatorioTabular, type TipoColuna } from './relatorio-tabular';

/** Formatos de célula (o Excel mostra no idioma do computador do usuário: `R$ 1.234,50` em português). */
export const FORMATO_MOEDA = 'R$ #,##0.00';
export const FORMATO_DATA = 'dd/mm/yyyy';
export const FORMATO_PERCENTUAL = '0.00%';
const FORMATO_INTEIRO = '#,##0';
const FORMATO_DECIMAL = '#,##0.00';

/** Cor do tema (hex #RRGGBB, como em `COR` de email/modelo-email.ts) no formato ARGB do exceljs. */
const argb = (hex: string) => `FF${hex.replace('#', '').toUpperCase()}`;

/** Nome de aba: sem `\ / ? * [ ] :`, no máximo 31 caracteres. */
const nomeAba = (titulo: string) => titulo.replace(/[\\/?*[\]:]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 31) || 'Relatório';

/** O que vai na célula e o formato dela. Texto neutraliza fórmula; valor que não bate com o tipo vira texto. */
function celula(tipo: TipoColuna, valor: unknown): { valor: ExcelJS.CellValue; formato?: string; direita: boolean } {
  if (valor === null || valor === undefined || valor === '') return { valor: null, direita: false };
  if (tipo === 'data') {
    const dia = lerDia(valor);
    if (dia) return { valor: new Date(Date.UTC(dia.ano, dia.mes - 1, dia.dia)), formato: FORMATO_DATA, direita: true };
  } else if (tipo !== 'texto') {
    const n = lerNumero(valor);
    if (n !== null) {
      const formato = tipo === 'moeda' ? FORMATO_MOEDA : tipo === 'percentual' ? FORMATO_PERCENTUAL : Number.isInteger(n) ? FORMATO_INTEIRO : FORMATO_DECIMAL;
      return { valor: n, formato, direita: true };
    }
  }
  return { valor: neutralizarFormula(textoDe(valor)), direita: false };
}

/**
 * O relatório em .xlsx: nome do sistema e título no topo, cabeçalho com a cor primária (#2F6FED, letra branca em
 * negrito), filtro e linhas congeladas, números e datas como números e datas de verdade (formato brasileiro), colunas
 * com largura pelo conteúdo e linha de totais. Texto que parece fórmula (`=`, `+`, `-`, `@`) ganha apóstrofo.
 * Tudo em memória: quem chama limita as linhas (ver `ExportacaoService`); para milhões de linhas use
 * `ExcelJS.stream.xlsx.WorkbookWriter` em vez deste.
 */
export async function paraExcel(r: RelatorioTabular, identidade: IdentidadeExportacao = IDENTIDADE_PADRAO): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = identidade.nomeSistema;
  wb.created = new Date();
  const aba = wb.addWorksheet(nomeAba(r.titulo));

  aba.getCell(1, 1).value = identidade.nomeSistema;
  aba.getCell(1, 1).font = { bold: true, size: 14, color: { argb: argb(COR.primaria) } };
  aba.getCell(2, 1).value = r.titulo;
  aba.getCell(2, 1).font = { bold: true, size: 12, color: { argb: argb(COR.texto) } };
  aba.getCell(3, 1).value = `Gerado em ${agoraBrasilia()} (Brasília)`;
  aba.getCell(3, 1).font = { size: 9, color: { argb: argb(COR.texto2) } };

  const linhaCabecalho = 4;
  const cabecalho = aba.getRow(linhaCabecalho);
  r.colunas.forEach((c, i) => {
    const cel = cabecalho.getCell(i + 1);
    cel.value = c.titulo;
    cel.font = { bold: true, color: { argb: argb(COR.sobrePrimaria) } };
    cel.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(COR.primaria) } };
    cel.alignment = { vertical: 'middle', horizontal: c.tipo === 'texto' ? 'left' : 'right' };
  });
  cabecalho.height = 22;

  const larguras = r.colunas.map((c) => c.titulo.length + 2);
  const escrever = (n: number, dados: Record<string, unknown>, negrito: boolean, rotulo: boolean) => {
    const linha = aba.getRow(n);
    r.colunas.forEach((c, i) => {
      const cel = linha.getCell(i + 1);
      const { valor, formato, direita } = rotulo && i === 0 ? { valor: 'Total', formato: undefined, direita: false } : celula(c.tipo, dados[c.chave]);
      cel.value = valor;
      if (formato) cel.numFmt = formato;
      if (direita) cel.alignment = { horizontal: 'right' };
      if (negrito) {
        cel.font = { bold: true };
        cel.border = { top: { style: 'thin', color: { argb: argb(COR.borda) } } };
      }
      const tamanho = valor instanceof Date ? 10 : textoDe(valor).length;
      larguras[i] = Math.max(larguras[i]!, Math.min(tamanho + 2, 60));
    });
  };

  r.linhas.forEach((dados, i) => escrever(linhaCabecalho + 1 + i, dados, false, false));
  if (r.totais) {
    const primeira = r.colunas[0];
    escrever(linhaCabecalho + 1 + r.linhas.length, r.totais, true, primeira?.tipo === 'texto' && r.totais[primeira.chave] === undefined);
  }

  r.colunas.forEach((_c, i) => (aba.getColumn(i + 1).width = Math.max(larguras[i]!, 10)));
  aba.views = [{ state: 'frozen', ySplit: linhaCabecalho }];
  if (r.colunas.length > 0) aba.autoFilter = { from: { row: linhaCabecalho, column: 1 }, to: { row: linhaCabecalho, column: r.colunas.length } };

  return Buffer.from(await wb.xlsx.writeBuffer());
}
