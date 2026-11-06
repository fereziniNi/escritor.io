// origem: skills-modelo/apps/web/src/lib/arquivos-api.ts
import { ErroApi } from '@/lib/api';

export type EscopoArquivo = 'PRIVADO' | 'GESTAO';

/** O que a API devolve de um arquivo (nunca a chave do objeto no armazenamento). */
export interface ArquivoEnviado {
  id: string;
  nome: string;
  tipo: string;
  tamanho: number;
  escopo: EscopoArquivo;
  donoId: string;
  varredura: 'LIMPO' | 'NAO_VARRIDO';
  criadoEm: string;
}

/** Extensões do seletor de arquivo. É só conforto: quem decide o tipo é a API, pelo conteúdo. */
export const ACEITAR = '.pdf,.png,.jpg,.jpeg,.xlsx';

const MENSAGENS: Record<number, string> = {
  413: 'O arquivo passa do tamanho permitido.',
  415: 'Tipo de arquivo não permitido. Envie PDF, PNG, JPEG ou Excel (.xlsx).',
  422: 'O arquivo foi bloqueado: o antivírus encontrou uma ameaça.',
  429: 'Muitos envios seguidos. Aguarde um instante e tente de novo.',
  503: 'Não foi possível verificar o arquivo agora. Tente de novo em instantes.',
};

/**
 * Envia um arquivo (multipart). O campo `escopo` vai ANTES do arquivo: a API lê o corpo em fluxo e decide quando o arquivo
 * começa. A sessão vai no cookie (same-origin); a API confere tamanho, tipo (pelo conteúdo) e antivírus.
 */
export async function enviarArquivo(arquivo: File, escopo: EscopoArquivo): Promise<ArquivoEnviado> {
  const corpo = new FormData();
  corpo.append('escopo', escopo);
  corpo.append('arquivo', arquivo, arquivo.name);
  let res: Response;
  try {
    res = await fetch('/api/arquivos', { method: 'POST', body: corpo, credentials: 'same-origin' });
  } catch {
    throw new ErroApi(0, 'API indisponível');
  }
  if (!res.ok) {
    const resposta = (await res.json().catch(() => null)) as { erro?: string } | null;
    throw new ErroApi(res.status, MENSAGENS[res.status] ?? resposta?.erro ?? `Erro ${res.status}`);
  }
  return (await res.json()) as ArquivoEnviado;
}
