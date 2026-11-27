// origem: skills-modelo/apps/web/src/lib/exportar-api.ts
import { ErroApi } from '@/lib/api';

export type FormatoExportacao = 'xlsx' | 'pdf' | 'csv';

export interface ArquivoBaixado {
  blob: Blob;
  nomeArquivo: string;
  /** A API cortou a exportação no máximo de linhas (EXPORTACAO_MAX_LINHAS; no PDF, 2.000). */
  truncado: boolean;
}

/** Nome do arquivo no Content-Disposition: `filename*` (acentos) primeiro, `filename` ASCII de reserva depois. */
export function nomeDoCabecalho(cabecalho: string | null): string | undefined {
  if (!cabecalho) return undefined;
  const utf8 = /filename\*=UTF-8''([^;]+)/i.exec(cabecalho)?.[1];
  if (utf8) {
    try {
      return decodeURIComponent(utf8);
    } catch {
      // cai para o nome ASCII
    }
  }
  return /filename="([^"]+)"/i.exec(cabecalho)?.[1];
}

/** GET `url?formato=...` (+ parâmetros) com a sessão; devolve o arquivo, o nome e se foi cortado. A API aplica a máscara de dados pessoais do papel. */
export async function baixarExportacao(url: string, formato: FormatoExportacao, parametros: Record<string, string> = {}): Promise<ArquivoBaixado> {
  const consulta = new URLSearchParams({ ...parametros, formato });
  let res: Response;
  try {
    res = await fetch(`${url}?${consulta.toString()}`, { credentials: 'same-origin' });
  } catch {
    throw new ErroApi(0, 'API indisponível');
  }
  if (!res.ok) {
    const corpo = (await res.json().catch(() => null)) as { erro?: string } | null;
    throw new ErroApi(res.status, corpo?.erro ?? `Erro ${res.status}`);
  }
  return {
    blob: await res.blob(),
    nomeArquivo: nomeDoCabecalho(res.headers.get('content-disposition')) ?? `exportacao.${formato}`,
    truncado: res.headers.get('x-exportacao-truncada') === 'true',
  };
}

/** Entrega o arquivo ao navegador (download). */
export function salvarArquivo({ blob, nomeArquivo }: Pick<ArquivoBaixado, 'blob' | 'nomeArquivo'>): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = nomeArquivo;
  link.click();
  URL.revokeObjectURL(url);
}
