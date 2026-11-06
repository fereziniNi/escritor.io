import { neutralizarFormula, textoCsv } from './formato';
import { type RelatorioTabular } from './relatorio-tabular';

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

/** O relatório em CSV (UTF-8 com BOM, `;`, CRLF): decimais com vírgula, datas dd/mm/aaaa, fórmulas neutralizadas. */
export function paraCsv(r: RelatorioTabular): Buffer {
  const celula = (tipo: RelatorioTabular['colunas'][number]['tipo'], valor: unknown): Celula => {
    const { texto, numerico } = textoCsv(tipo, valor);
    return numerico ? new CsvLiteral(texto) : texto;
  };
  const linhas: Celula[][] = r.linhas.map((l) => r.colunas.map((c) => celula(c.tipo, l[c.chave])));
  if (r.totais) {
    const totais = r.totais;
    const primeira = r.colunas[0];
    const rotuloNaPrimeira = primeira?.tipo === 'texto' && totais[primeira.chave] === undefined;
    linhas.push(r.colunas.map((c) => (rotuloNaPrimeira && c === primeira ? 'Total' : celula(c.tipo, totais[c.chave]))));
  }
  return Buffer.from(montarCsv(r.colunas.map((c) => c.titulo), linhas), 'utf8');
}
