import { PassThrough, type Readable } from 'node:stream';
import ExcelJS from 'exceljs';
import { COR } from '../email/modelo-email';
import { agoraBrasilia, lerDia, lerNumero, textoDe } from './formato';
import { IDENTIDADE_PADRAO, type IdentidadeExportacao, type Lotes, type MetaRelatorio, type RelatorioTabular, type TipoColuna } from './relatorio-tabular';

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

const LARGURA: Record<TipoColuna, number> = { texto: 32, moeda: 16, data: 13, numero: 14, percentual: 12 };
const LINHA_CABECALHO = 4;
/** Pausa entre lotes (ver `excelEmFluxo`). */
const PAUSA_MS = 5;

/**
 * O que vai na célula e o formato dela. Texto vai CRU: o .xlsx guarda texto como texto (o Excel nunca o avalia como
 * fórmula; só um valor `{ formula }` explícito seria), então `=1+1` chega à planilha como o texto `=1+1`, sem apóstrofo.
 * Valor que não bate com o tipo da coluna também vira texto.
 */
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
  return { valor: textoDe(valor), direita: false };
}

/**
 * O relatório em .xlsx, ESCRITO EM FLUXO (`ExcelJS.stream.xlsx.WorkbookWriter`): cada lote vira linhas e é descartado, então a
 * memória não cresce com o número de linhas. Nome do sistema e título no topo, cabeçalho com a cor primária (#2F6FED, letra
 * branca em negrito), filtro e linhas congeladas, números e datas como números e datas de verdade (formato brasileiro) e linha
 * de totais. Texto que parece fórmula (`=`, `+`, `-`, `@`) segue como texto literal (ver `celula`). O erro no meio do fluxo
 * destrói o fluxo (o download falha em vez de entregar planilha incompleta como se estivesse boa).
 */
export function excelEmFluxo(meta: MetaRelatorio, lotes: Lotes, identidade: IdentidadeExportacao = IDENTIDADE_PADRAO): Readable {
  const saida = new PassThrough();
  void (async () => {
    try {
      const wb = new ExcelJS.stream.xlsx.WorkbookWriter({ stream: saida, useStyles: true, useSharedStrings: false });
      wb.creator = identidade.nomeSistema;
      wb.created = new Date();
      const cols = meta.colunas;
      const aba = wb.addWorksheet(nomeAba(meta.titulo), {
        views: [{ state: 'frozen', ySplit: LINHA_CABECALHO }],
        ...(cols.length > 0 ? { autoFilter: { from: { row: LINHA_CABECALHO, column: 1 }, to: { row: LINHA_CABECALHO, column: cols.length } } } : {}),
      });
      aba.columns = cols.map((c) => ({ width: Math.max(LARGURA[c.tipo], c.titulo.length + 3) }));

      const topo = (n: number, texto: string, fonte: Partial<ExcelJS.Font>) => {
        const linha = aba.getRow(n);
        linha.getCell(1).value = texto;
        linha.getCell(1).font = fonte;
        linha.commit();
      };
      topo(1, identidade.nomeSistema, { bold: true, size: 14, color: { argb: argb(COR.primaria) } });
      topo(2, meta.titulo, { bold: true, size: 12, color: { argb: argb(COR.texto) } });
      topo(3, `Gerado em ${agoraBrasilia()} (Brasília)`, { size: 9, color: { argb: argb(COR.texto2) } });

      const cabecalho = aba.getRow(LINHA_CABECALHO);
      cols.forEach((c, i) => {
        const cel = cabecalho.getCell(i + 1);
        cel.value = c.titulo;
        cel.font = { bold: true, color: { argb: argb(COR.sobrePrimaria) } };
        cel.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(COR.primaria) } };
        cel.alignment = { vertical: 'middle', horizontal: c.tipo === 'texto' ? 'left' : 'right' };
      });
      cabecalho.height = 22;
      cabecalho.commit();

      let n = LINHA_CABECALHO;
      const escrever = (dados: Record<string, unknown>, negrito: boolean, rotulo: boolean) => {
        const linha = aba.getRow(++n);
        cols.forEach((c, i) => {
          const cel = linha.getCell(i + 1);
          const { valor, formato, direita } = rotulo && i === 0 ? { valor: 'Total', formato: undefined, direita: false } : celula(c.tipo, dados[c.chave]);
          cel.value = valor;
          if (formato) cel.numFmt = formato;
          if (direita) cel.alignment = { horizontal: 'right' };
          if (negrito) {
            cel.font = { bold: true };
            cel.border = { top: { style: 'thin', color: { argb: argb(COR.borda) } } };
          }
        });
        linha.commit();
      };

      for await (const lote of lotes) {
        for (const dados of lote) escrever(dados, false, false);
        // Dá tempo à compressão do zip (roda em outra thread) e cede o laço de eventos: o exceljs não aplica pressão de volta
        // entre a escrita das linhas e o deflate, então sem esta pausa os lotes se acumulam na memória (medido: 100.000 x 10
        // chegava a ~300 MB de buffers externos; com a pausa ficam em ~6 MB e o crescimento deixa de depender das linhas).
        await new Promise<void>((ok) => setTimeout(ok, PAUSA_MS));
        // Respeita também o consumidor: se o download está lento, espera esvaziar a saída.
        if (saida.writableNeedDrain) await new Promise<void>((ok) => saida.once('drain', ok));
      }
      if (meta.totais) {
        const primeira = cols[0];
        escrever(meta.totais, true, primeira?.tipo === 'texto' && meta.totais[primeira.chave] === undefined);
      }
      aba.commit();
      await wb.commit();
    } catch (e) {
      saida.destroy(new Error('falha ao gerar o Excel', { cause: e }));
    }
  })();
  return saida;
}

async function* umLote(linhas: Record<string, unknown>[]): AsyncGenerator<Record<string, unknown>[]> {
  await Promise.resolve();
  yield linhas;
}

/** O relatório inteiro (já na memória) em .xlsx: o mesmo escritor em fluxo, juntado num Buffer. Para volume grande use `excelEmFluxo`. */
export async function paraExcel(r: RelatorioTabular, identidade: IdentidadeExportacao = IDENTIDADE_PADRAO): Promise<Buffer> {
  const partes: Buffer[] = [];
  for await (const parte of excelEmFluxo(r, umLote(r.linhas), identidade)) partes.push(parte as Buffer);
  return Buffer.concat(partes);
}
