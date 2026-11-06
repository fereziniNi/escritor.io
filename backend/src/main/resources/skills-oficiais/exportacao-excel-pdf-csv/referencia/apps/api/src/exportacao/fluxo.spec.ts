// origem: skills-modelo/apps/api/src/exportacao/fluxo.spec.ts
import { Writable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { csvEmFluxo } from './csv';
import { excelEmFluxo } from './excel';
import { type Lotes, type MetaRelatorio } from './relatorio-tabular';

const LINHAS = 100_000;
const LOTE = 500;
const meta: MetaRelatorio = {
  titulo: 'Volume',
  colunas: [
    { chave: 'a', titulo: 'Texto A', tipo: 'texto' },
    { chave: 'b', titulo: 'Texto B', tipo: 'texto' },
    { chave: 'c', titulo: 'Texto C', tipo: 'texto' },
    { chave: 'd', titulo: 'Texto D', tipo: 'texto' },
    { chave: 'e', titulo: 'Valor E', tipo: 'moeda' },
    { chave: 'f', titulo: 'Valor F', tipo: 'moeda' },
    { chave: 'g', titulo: 'Número G', tipo: 'numero' },
    { chave: 'h', titulo: 'Número H', tipo: 'numero' },
    { chave: 'i', titulo: 'Taxa I', tipo: 'percentual' },
    { chave: 'j', titulo: 'Dia J', tipo: 'data' },
  ],
};

async function* gerar(total: number): Lotes {
  for (let i = 0; i < total; i += LOTE) {
    await Promise.resolve();
    yield Array.from({ length: Math.min(LOTE, total - i) }, (_, k) => {
      const n = i + k;
      return { a: `linha ${n} ação`, b: `texto b ${n}`, c: `texto c ${n}`, d: 'observação fixa com ç e ã', e: n * 1.5, f: n / 3, g: n, h: n + 0.25, i: (n % 100) / 100, j: '2026-03-05' };
    });
  }
}

/** Consome o fluxo para o nada, medindo o maior RSS visto e quantos bytes passaram. */
async function consumir(leitura: NodeJS.ReadableStream) {
  let bytes = 0;
  let pico = process.memoryUsage().rss;
  const amostra = setInterval(() => (pico = Math.max(pico, process.memoryUsage().rss)), 20);
  const inicio = process.memoryUsage().rss;
  try {
    await pipeline(
      leitura,
      new Writable({
        write(parte: Buffer, _enc, cb) {
          bytes += parte.length;
          cb();
        },
      }),
    );
  } finally {
    clearInterval(amostra);
  }
  pico = Math.max(pico, process.memoryUsage().rss);
  return { bytes, crescimentoMb: (pico - inicio) / 1024 / 1024 };
}

describe('exportação em fluxo: 100.000 linhas x 10 colunas', () => {
  it('Excel: memória não cresce com as linhas (pico de RSS acima do início abaixo de 250 MB)', async () => {
    const { bytes, crescimentoMb } = await consumir(excelEmFluxo(meta, gerar(LINHAS)));
    process.stdout.write(`RSS Excel ${LINHAS}x10: crescimento de pico ${crescimentoMb.toFixed(0)} MB, arquivo ${(bytes / 1024 / 1024).toFixed(1)} MB\n`);
    expect(bytes).toBeGreaterThan(1_000_000);
    expect(crescimentoMb).toBeLessThan(250);
  }, 120_000);

  it('CSV: memória não cresce com as linhas (abaixo de 150 MB)', async () => {
    const { bytes, crescimentoMb } = await consumir(csvEmFluxo(meta, gerar(LINHAS)));
    process.stdout.write(`RSS CSV ${LINHAS}x10: crescimento de pico ${crescimentoMb.toFixed(0)} MB, arquivo ${(bytes / 1024 / 1024).toFixed(1)} MB\n`);
    expect(bytes).toBeGreaterThan(1_000_000);
    expect(crescimentoMb).toBeLessThan(150);
  }, 120_000);

  it('o Excel em fluxo é um .xlsx válido com todas as linhas (lido de volta)', async () => {
    const partes: Buffer[] = [];
    for await (const p of excelEmFluxo(meta, gerar(1200))) partes.push(p as Buffer);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(Buffer.concat(partes) as unknown as ArrayBuffer);
    const aba = wb.worksheets[0]!;
    expect(aba.rowCount).toBe(4 + 1200);
    expect(aba.getRow(5).getCell(5).numFmt).toBe('R$ #,##0.00');
  });

  it('erro no meio do fluxo derruba o fluxo (não entrega arquivo incompleto como se estivesse bom)', async () => {
    async function* quebra(): Lotes {
      await Promise.resolve();
      yield [{ a: 'x' }];
      throw new Error('banco caiu');
    }
    await expect(consumir(excelEmFluxo(meta, quebra()))).rejects.toThrow(/Excel/);
    await expect(consumir(csvEmFluxo(meta, quebra()))).rejects.toThrow(/banco caiu/);
  });
});
