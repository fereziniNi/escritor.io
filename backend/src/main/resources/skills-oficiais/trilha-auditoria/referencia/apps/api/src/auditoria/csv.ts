// origem: skills-modelo/apps/api/src/auditoria/csv.ts
/** BOM UTF-8: sem ele o Excel em português abre o arquivo com os acentos quebrados. */
export const BOM = '﻿';
const SEPARADOR = ';';
const FIM_DE_LINHA = '\r\n';

type Celula = string | number | null | undefined;

/**
 * Uma célula de CSV para o Excel brasileiro. Texto que começa com `=`, `+`, `-`, `@`, tab ou CR ganha um apóstrofo na
 * frente: a planilha mostra texto e não executa fórmula (CSV injection). Entre aspas quando tem `;`, aspas ou quebra de linha.
 */
export function celulaCsv(valor: Celula): string {
  if (valor === null || valor === undefined) return '';
  let texto = String(valor);
  if (typeof valor === 'string' && /^[=+\-@\t\r]/.test(texto)) texto = `'${texto}`;
  return /[;"\r\n]/.test(texto) ? `"${texto.replaceAll('"', '""')}"` : texto;
}

/** CSV completo: BOM, cabeçalho e linhas separadas por `;`, cada uma terminada em CRLF. */
export function montarCsv(cabecalho: readonly string[], linhas: readonly (readonly Celula[])[]): string {
  const todas = [cabecalho, ...linhas];
  return BOM + todas.map((l) => l.map(celulaCsv).join(SEPARADOR) + FIM_DE_LINHA).join('');
}
