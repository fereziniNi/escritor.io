// origem: skills-modelo/packages/contratos/src/auditoria.ts
import { z } from 'zod';

/** Nome de ação: `grupo.acao` em minúsculas, números e _ (ex.: `usuario.desativar`, `auth.login`). Até 64 caracteres. */
export const FORMATO_ACAO = /^[a-z][a-z0-9_]*(\.[a-z0-9_]+)+$/;

/** Ações que o modelo registra. Outras skills acrescentam as suas; a API aceita qualquer nome no formato acima. */
export const ACOES_CONHECIDAS = [
  'auth.login',
  'auth.logout',
  'auth.falha_login',
  'auth.codigo_bloqueado',
  'auth.limite_codigo',
  'usuario.convidar',
  'usuario.alterar_papel',
  'usuario.desativar',
  'usuario.reativar',
  'auditoria.exportar',
] as const;

/** Um evento da trilha como a API devolve em /api/admin/auditoria. `id` é texto (bigint no banco). */
export const esquemaEventoAuditoria = z.object({
  id: z.string().min(1),
  ocorridoEm: z.string().min(1),
  atorId: z.uuid().nullable(),
  /** E-mail do ator quando ele é um usuário do sistema (junção na leitura; a trilha em si guarda só o id). */
  atorEmail: z.string().nullable(),
  acao: z.string().min(1),
  alvoTipo: z.string().nullable(),
  alvoId: z.string().nullable(),
  antes: z.unknown(),
  depois: z.unknown(),
  ip: z.string().nullable(),
  requestId: z.string().nullable(),
});
export type EventoAuditoria = z.infer<typeof esquemaEventoAuditoria>;

export const esquemaPaginaAuditoria = z.object({
  itens: z.array(esquemaEventoAuditoria),
  /** Passe em `cursor` para a página seguinte; nulo na última. */
  proximoCursor: z.string().nullable(),
});
export type PaginaAuditoria = z.infer<typeof esquemaPaginaAuditoria>;

/** Texto vazio (campo em branco do formulário) vale como ausente. */
const opcional = <T extends z.ZodType>(esquema: T) => z.preprocess((v) => (v === '' ? undefined : v), esquema.optional());

export const LIMITE_PADRAO_AUDITORIA = 50;
export const LIMITE_MAXIMO_AUDITORIA = 200;

/** Filtros de /api/admin/auditoria e /csv. `de` e `ate` são instantes ISO COM fuso (inclusivos). */
export const esquemaConsultaAuditoria = z.object({
  de: opcional(z.iso.datetime({ offset: true })),
  ate: opcional(z.iso.datetime({ offset: true })),
  atorId: opcional(z.uuid()),
  acao: opcional(z.string().max(64).regex(FORMATO_ACAO, 'formato grupo.acao')),
  cursor: opcional(z.string().regex(/^\d{1,18}$/)),
  limite: z.coerce.number().int().min(1).max(LIMITE_MAXIMO_AUDITORIA).default(LIMITE_PADRAO_AUDITORIA),
});
export type ConsultaAuditoria = z.infer<typeof esquemaConsultaAuditoria>;
