// origem: skills-modelo/apps/api/src/auditoria/evento-auditoria.tabela.ts
import { bigint, index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

/**
 * Trilha de auditoria: quem fez o quê, em quê, quando, de onde. SÓ CRESCE. A imutabilidade vem de duas camadas
 * (migração `imutabilidade_auditoria`): o papel de runtime `app_runtime` não tem UPDATE, DELETE nem TRUNCATE nesta
 * tabela, e um gatilho bloqueia UPDATE, DELETE e TRUNCATE até para o dono. Nunca edite o SQL dessa migração à mão.
 *
 * `ator_id` é nulo para o sistema ou para quem ainda não se identificou (falha de login). Sem chave estrangeira de
 * propósito: a trilha não depende de a linha do usuário existir. `antes`/`depois` nunca levam código, token, cookie
 * ou segredo (ver `sanitizar.ts`); dado pessoal só mascarado.
 */
export const eventoAuditoria = pgTable(
  'evento_auditoria',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    ocorridoEm: timestamp('ocorrido_em', { withTimezone: true }).notNull().defaultNow(),
    atorId: uuid('ator_id'),
    /** `grupo.acao`, ex.: `usuario.desativar`. */
    acao: text('acao').notNull(),
    alvoTipo: text('alvo_tipo'),
    alvoId: text('alvo_id'),
    antes: jsonb('antes'),
    depois: jsonb('depois'),
    ip: text('ip'),
    requestId: text('request_id'),
  },
  (t) => [
    index('evento_auditoria_ocorrido').on(t.ocorridoEm),
    index('evento_auditoria_ator').on(t.atorId, t.ocorridoEm),
    index('evento_auditoria_acao').on(t.acao, t.ocorridoEm),
    index('evento_auditoria_alvo').on(t.alvoTipo, t.alvoId),
  ],
);
