// origem: skills-modelo/apps/web/src/lib/auditoria-api.ts
import { type PaginaAuditoria, esquemaPaginaAuditoria } from 'contratos';
import { ErroApi, pedir } from '@/lib/api';

/** Filtros da tela. `de` e `ate` são dias (AAAA-MM-DD) como o campo de data entrega. */
export interface FiltrosAuditoria {
  de?: string;
  ate?: string;
  atorId?: string;
  acao?: string;
}

/**
 * Dia inteiro no horário de Brasília (UTC-3 fixo: o Brasil não tem mais horário de verão desde 2019). A API recebe
 * instantes ISO com fuso, `de` e `ate` inclusivos.
 */
function parametros(f: FiltrosAuditoria): URLSearchParams {
  const p = new URLSearchParams();
  if (f.de) p.set('de', `${f.de}T00:00:00-03:00`);
  if (f.ate) p.set('ate', `${f.ate}T23:59:59.999-03:00`);
  if (f.atorId) p.set('atorId', f.atorId);
  if (f.acao?.trim()) p.set('acao', f.acao.trim());
  return p;
}

export function listarEventos(filtros: FiltrosAuditoria, cursor?: string): Promise<PaginaAuditoria> {
  const p = parametros(filtros);
  if (cursor) p.set('cursor', cursor);
  return pedir(`/api/admin/auditoria?${p.toString()}`, esquemaPaginaAuditoria);
}

export interface ArquivoCsv {
  blob: Blob;
  nomeArquivo: string;
  /** A API cortou a exportação no máximo de linhas (10.000). */
  truncado: boolean;
}

/** Baixa o CSV com os mesmos filtros (a API também registra a exportação na trilha). */
export async function baixarCsv(filtros: FiltrosAuditoria): Promise<ArquivoCsv> {
  let res: Response;
  try {
    res = await fetch(`/api/admin/auditoria/csv?${parametros(filtros).toString()}`, { credentials: 'same-origin' });
  } catch {
    throw new ErroApi(0, 'API indisponível');
  }
  if (!res.ok) {
    const corpo = (await res.json().catch(() => null)) as { erro?: string } | null;
    throw new ErroApi(res.status, corpo?.erro ?? `Erro ${res.status}`);
  }
  const nome = /filename="([A-Za-z0-9._-]+)"/.exec(res.headers.get('content-disposition') ?? '')?.[1];
  return { blob: await res.blob(), nomeArquivo: nome ?? 'auditoria.csv', truncado: res.headers.get('x-exportacao-truncada') === 'true' };
}
