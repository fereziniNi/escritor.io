import { type Extensao } from './chave';

export interface TipoArquivo {
  extensao: Extensao;
  mime: string;
}

const PDF: TipoArquivo = { extensao: 'pdf', mime: 'application/pdf' };
const PNG: TipoArquivo = { extensao: 'png', mime: 'image/png' };
const JPEG: TipoArquivo = { extensao: 'jpg', mime: 'image/jpeg' };
const XLSX: TipoArquivo = { extensao: 'xlsx', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' };

/** Os tipos aceitos. SVG, HTML, executáveis e Office com macro ficam de fora de propósito (XSS armazenado, malware). */
export const TIPOS_PERMITIDOS: readonly Extensao[] = ['pdf', 'png', 'jpg', 'xlsx'];

/** Quantos bytes do início do arquivo `validarTipo` precisa olhar (as primeiras entradas do ZIP do XLSX cabem folgadas). */
export const BYTES_DO_CABECALHO = 16 * 1024;

const ASSINATURA_ZIP = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
const ASSINATURA_PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** Nomes das entradas de ZIP (cabeçalhos locais `PK\3\4`) que aparecem nos primeiros bytes, em ordem. */
function entradasDoZip(cabecalho: Buffer): string[] {
  const nomes: string[] = [];
  let pos = cabecalho.indexOf(ASSINATURA_ZIP);
  while (pos >= 0 && pos + 30 <= cabecalho.length) {
    const tamanhoNome = cabecalho.readUInt16LE(pos + 26);
    if (pos + 30 + tamanhoNome <= cabecalho.length) nomes.push(cabecalho.toString('latin1', pos + 30, pos + 30 + tamanhoNome));
    pos = cabecalho.indexOf(ASSINATURA_ZIP, pos + 4);
  }
  return nomes;
}

/** XLSX = ZIP cuja 1ª entrada é `[Content_Types].xml`, com entradas `xl/` e sem `word/`, `ppt/` nem macro (`vbaProject`). */
function ehXlsx(cabecalho: Buffer): boolean {
  const nomes = entradasDoZip(cabecalho);
  if (nomes[0] !== '[Content_Types].xml') return false;
  if (!nomes.some((n) => n.startsWith('xl/'))) return false;
  return !nomes.some((n) => n.startsWith('word/') || n.startsWith('ppt/') || /vbaProject/i.test(n));
}

/**
 * Descobre o tipo pelo CONTEÚDO (assinatura de bytes), nunca pelo nome nem pelo Content-Type que o cliente mandou. Recebe
 * o início do arquivo (`BYTES_DO_CABECALHO`). Devolve null se não for um dos `permitidos`. É uma checagem de formato, não
 * de segurança do conteúdo: por isso o download é sempre anexo (nunca inline) e o antivírus é opcional por cima.
 */
export function validarTipo(cabecalho: Buffer, permitidos: readonly Extensao[] = TIPOS_PERMITIDOS): TipoArquivo | null {
  const achado = detectar(cabecalho);
  return achado && permitidos.includes(achado.extensao) ? achado : null;
}

function detectar(c: Buffer): TipoArquivo | null {
  // "%PDF-1.x": a versão confirma o cabeçalho (7 bytes).
  if (c.length >= 8 && c.toString('latin1', 0, 5) === '%PDF-' && /^\d\.\d$/.test(c.toString('latin1', 5, 8))) return PDF;
  if (c.length >= 8 && c.subarray(0, 8).equals(ASSINATURA_PNG)) return PNG;
  if (c.length >= 3 && c[0] === 0xff && c[1] === 0xd8 && c[2] === 0xff) return JPEG;
  if (c.length >= 30 && c.subarray(0, 4).equals(ASSINATURA_ZIP) && ehXlsx(c)) return XLSX;
  return null;
}
