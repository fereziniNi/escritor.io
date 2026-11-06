import { type TipoColuna } from './relatorio-tabular';

/** Texto que a planilha executaria como fórmula (`=`, `+`, `-`, `@`, tab, CR no começo). */
const PERIGO_DE_FORMULA = /^[=+\-@\t\r]/;

/**
 * Neutraliza fórmula de planilha (CSV injection / DDE): ganha um apóstrofo na frente, e a célula mostra texto. Vale para
 * o CSV e para toda célula de TEXTO do Excel (o xlsx guarda texto como texto, mas o arquivo costuma ser reexportado
 * para CSV ou colado em outra planilha, onde a fórmula voltaria a valer).
 */
export function neutralizarFormula(texto: string): string {
  return PERIGO_DE_FORMULA.test(texto) ? `'${texto}` : texto;
}

/** Texto de qualquer valor de célula: texto como está, número e data legíveis, objeto como JSON (nunca `[object Object]`). */
export function textoDe(valor: unknown): string {
  if (typeof valor === 'string') return valor;
  if (valor instanceof Date) return Number.isNaN(valor.getTime()) ? '' : valor.toISOString();
  if (typeof valor === 'number' || typeof valor === 'boolean' || typeof valor === 'bigint') return String(valor);
  if (valor === null || valor === undefined) return '';
  try {
    return JSON.stringify(valor) ?? '';
  } catch {
    return '';
  }
}

export interface DiaCivil {
  ano: number;
  mes: number;
  dia: number;
}

const partesBrasilia = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' });

/** Dia de uma data: `AAAA-MM-DD` puro fica como está; instante (Date ou ISO com horário) vira o dia em Brasília. Inválido → null. */
export function lerDia(valor: unknown): DiaCivil | null {
  if (valor === null || valor === undefined || valor === '') return null;
  if (typeof valor === 'string') {
    const pura = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor);
    if (pura) return { ano: Number(pura[1]), mes: Number(pura[2]), dia: Number(pura[3]) };
  }
  if (!(valor instanceof Date) && typeof valor !== 'string' && typeof valor !== 'number') return null;
  const data = valor instanceof Date ? valor : new Date(valor);
  if (Number.isNaN(data.getTime())) return null;
  const [ano, mes, dia] = partesBrasilia.format(data).split('-').map(Number);
  return { ano: ano!, mes: mes!, dia: dia! };
}

const dois = (n: number) => String(n).padStart(2, '0');

export const diaBr = (d: DiaCivil): string => `${dois(d.dia)}/${dois(d.mes)}/${d.ano}`;

/** Número de um valor (número ou texto numérico, como o `numeric` do Postgres devolve). Outra coisa → null. */
export function lerNumero(valor: unknown): number | null {
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : null;
  if (typeof valor === 'string' && /^-?\d+(\.\d+)?$/.test(valor.trim())) return Number(valor);
  return null;
}

const comVirgula = (n: number, casas?: number) => (casas === undefined ? String(n) : n.toFixed(casas)).replace('.', ',');

/** Valor para o CSV: decimal com vírgula, sem separador de milhar (o Excel brasileiro lê como número). Nulo → vazio. */
export function textoCsv(tipo: TipoColuna, valor: unknown): { texto: string; numerico: boolean } {
  if (valor === null || valor === undefined || valor === '') return { texto: '', numerico: false };
  if (tipo === 'data') {
    const dia = lerDia(valor);
    return dia ? { texto: diaBr(dia), numerico: true } : { texto: textoDe(valor), numerico: false };
  }
  if (tipo === 'moeda' || tipo === 'numero' || tipo === 'percentual') {
    const n = lerNumero(valor);
    if (n === null) return { texto: textoDe(valor), numerico: false };
    if (tipo === 'moeda') return { texto: comVirgula(n, 2), numerico: true };
    if (tipo === 'percentual') return { texto: `${comVirgula(n * 100, 2)}%`, numerico: true };
    return { texto: comVirgula(n), numerico: true };
  }
  return { texto: textoDe(valor), numerico: false };
}

const fmtMoeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtNumero = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });
const fmtPercentual = new Intl.NumberFormat('pt-BR', { style: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Valor para o PDF e telas: `R$ 1.234,50`, `1.500`, `12,50%`, `05/03/2026`. Nulo → vazio. */
export function textoLegivel(tipo: TipoColuna, valor: unknown): string {
  if (valor === null || valor === undefined || valor === '') return '';
  if (tipo === 'data') {
    const dia = lerDia(valor);
    return dia ? diaBr(dia) : textoDe(valor);
  }
  if (tipo === 'moeda' || tipo === 'numero' || tipo === 'percentual') {
    const n = lerNumero(valor);
    if (n === null) return textoDe(valor);
    const formatador = tipo === 'moeda' ? fmtMoeda : tipo === 'percentual' ? fmtPercentual : fmtNumero;
    // O Intl usa espaço sem quebra entre R$ e o número; o PDF e a busca de texto preferem espaço comum.
    return formatador.format(n).replace(/\s/g, ' ');
  }
  return textoDe(valor);
}

const partesAgora = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/** "05/11/2026 12:30" no horário de Brasília. */
export const agoraBrasilia = (agora: Date = new Date()): string => partesAgora.format(agora).replace(',', '');

/** AAAAMMDD no horário de Brasília (nome de arquivo). */
export function diaParaArquivo(agora: Date = new Date()): string {
  return partesBrasilia.format(agora).replaceAll('-', '');
}
