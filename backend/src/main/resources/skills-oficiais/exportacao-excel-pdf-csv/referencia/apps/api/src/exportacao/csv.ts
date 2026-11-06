// origem: skills-modelo/apps/api/src/exportacao/csv.ts
import { Readable } from 'node:stream';
import { neutralizarFormula, textoCsv } from './formato';
import { type Lotes, type MetaRelatorio, type RelatorioTabular } from './relatorio-tabular';

/** BOM UTF-8: sem ele o Excel em português abre o arquivo com os acentos quebrados. */
export const BOM = '﻿';
const SEPARADOR = ';';
const FIM_DE_LINHA = '\r\n';

/** Texto já formatado (número, data) que NÃO deve passar pela neutralização de fórmula: `-1234,50` é número, não fórmula. */
export class CsvLiteral {
  constructor(readonly texto: string) {}
}

type Celula = string | number | null | undefined | CsvLiteral;

const pedeAspas = (texto: string) => (/[;"\r\n]/.test(texto) ? `"${texto.replaceAll('"', '""')}"` : texto);

/**
 * Uma célula de CSV para o Excel brasileiro. Texto que começa com `=`, `+`, `-`, `@`, tab ou CR ganha um apóstrofo na
 * frente: a planilha mostra texto e não executa fórmula (CSV injection). Entre aspas quando tem `;`, aspas ou quebra de linha.
 */
export function celulaCsv(valor: Celula): string {
  if (valor === null || valor === undefined) return '';
  if (valor instanceof CsvLiteral) return pedeAspas(valor.texto);
  return pedeAspas(typeof valor === 'string' ? neutralizarFormula(valor) : String(valor));
}

/** CSV completo: BOM, cabeçalho e linhas separadas por `;`, cada uma terminada em CRLF. */
export function montarCsv(cabecalho: readonly string[], linhas: readonly (readonly Celula[])[]): string {
  const todas = [cabecalho, ...linhas];
  return BOM + todas.map((l) => l.map(celulaCsv).join(SEPARADOR) + FIM_DE_LINHA).join('');
}

type Coluna = RelatorioTabular['colunas'][number];

const celulaTipada = (tipo: Coluna['tipo'], valor: unknown): Celula => {
  const { texto, numerico } = textoCsv(tipo, valor);
  return numerico ? new CsvLiteral(texto) : texto;
};

const linhaCsv = (celulas: readonly Celula[]) => celulas.map(celulaCsv).join(SEPARADOR) + FIM_DE_LINHA;

/** Linhas de dados (texto CSV sem cabeçalho) de um lote. */
const linhasDoLote = (colunas: Coluna[], lote: Record<string, unknown>[]) => lote.map((l) => linhaCsv(colunas.map((c) => celulaTipada(c.tipo, l[c.chave])))).join('');

function linhaTotais(meta: MetaRelatorio): string {
  if (!meta.totais) return '';
  const totais = meta.totais;
  const primeira = meta.colunas[0];
  const rotuloNaPrimeira = primeira?.tipo === 'texto' && totais[primeira.chave] === undefined;
  return linhaCsv(meta.colunas.map((c) => (rotuloNaPrimeira && c === primeira ? 'Total' : celulaTipada(c.tipo, totais[c.chave]))));
}

const cabecalhoCsv = (meta: MetaRelatorio) => BOM + linhaCsv(meta.colunas.map((c) => c.titulo));

/**
 * CSV em FLUXO (UTF-8 com BOM, `;`, CRLF): um lote por vez, com a pressão de volta do download (o `Readable.from` só pede o
 * próximo lote quando o anterior foi consumido). Decimais com vírgula, datas dd/mm/aaaa, fórmulas neutralizadas.
 */
export function csvEmFluxo(meta: MetaRelatorio, lotes: Lotes): Readable {
  async function* gerar() {
    yield Buffer.from(cabecalhoCsv(meta), 'utf8');
    for await (const lote of lotes) yield Buffer.from(linhasDoLote(meta.colunas, lote), 'utf8');
    yield Buffer.from(linhaTotais(meta), 'utf8');
  }
  return Readable.from(gerar(), { objectMode: false });
}

/** O relatório inteiro (já na memória) em CSV. Para volume grande use `csvEmFluxo`. */
export function paraCsv(r: RelatorioTabular): Buffer {
  return Buffer.from(cabecalhoCsv(r) + linhasDoLote(r.colunas, r.linhas) + linhaTotais(r), 'utf8');
}
