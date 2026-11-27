import { type PaginaAuditoria, esquemaPaginaAuditoria } from 'contratos';
import { pedir } from '@/lib/api';

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

/** Os filtros aplicados como parâmetros do `BotaoExportar` (a API exporta com os mesmos filtros da listagem). */
export const parametrosExportacao = (filtros: FiltrosAuditoria): Record<string, string> => Object.fromEntries(parametros(filtros));
