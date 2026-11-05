// origem: skills-modelo/apps/api/src/auth/auth.tabelas.ts
import { boolean, index, integer, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { usuario } from '../usuarios/usuario.tabela';

/**
 * Códigos de acesso pedidos. O código em claro NUNCA é gravado: só o HMAC-SHA256 (com AUTH_SEGREDO_CODIGO) ligado ao
 * e-mail. Um código novo invalida os anteriores (expira_em vira now()). Linhas com mais de 1 dia são apagadas no
 * próximo pedido do mesmo e-mail.
 */
export const codigoLogin = pgTable(
  'codigo_login',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: text('email').notNull(),
    hmac: text('hmac').notNull(),
    expiraEm: timestamp('expira_em', { withTimezone: true }).notNull(),
    /** Contada ANTES de comparar o código: a 6ª tentativa falha mesmo com o código certo. */
    tentativas: integer('tentativas').notNull().default(0),
    usado: boolean('usado').notNull().default(false),
    criadoEm: timestamp('criado_em', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('codigo_login_email_criado').on(t.email, t.criadoEm)],
);

/**
 * Sessões abertas. O token vai só no cookie; aqui fica o SHA-256 dele (`hash_token`): quem lê o banco não consegue
 * usar uma sessão. Validade: ociosa (ultimo_uso_em) e absoluta (criada_em), ambas checadas a cada requisição.
 * Sair marca `revogada = true` (a linha fica para histórico até ser limpa no próximo login do usuário).
 */
export const sessao = pgTable(
  'sessao',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    hashToken: text('hash_token').notNull(),
    usuarioId: uuid('usuario_id')
      .notNull()
      .references(() => usuario.id),
    criadaEm: timestamp('criada_em', { withTimezone: true }).notNull().defaultNow(),
    ultimoUsoEm: timestamp('ultimo_uso_em', { withTimezone: true }).notNull().defaultNow(),
    revogada: boolean('revogada').notNull().default(false),
  },
  (t) => [uniqueIndex('sessao_hash_token_unico').on(t.hashToken), index('sessao_usuario').on(t.usuarioId)],
);
