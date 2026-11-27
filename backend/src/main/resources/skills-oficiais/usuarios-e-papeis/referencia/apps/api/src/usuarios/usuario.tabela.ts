// origem: skills-modelo/apps/api/src/usuarios/usuario.tabela.ts
import { sql } from 'drizzle-orm';
import { boolean, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { PAPEIS } from './papel';

export const papelEnum = pgEnum('papel', PAPEIS);

/**
 * Usuários do sistema. Nunca se apaga uma linha: desativar é `ativo = false` (o histórico e as chaves estrangeiras
 * das outras tabelas continuam válidos). O e-mail é guardado em minúsculas e sem espaços; o índice único em
 * `lower(email)` garante isso mesmo se alguém inserir direto no banco.
 */
export const usuario = pgTable(
  'usuario',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: text('email').notNull(),
    nome: text('nome').notNull(),
    papel: papelEnum('papel').notNull().default('USUARIO'),
    ativo: boolean('ativo').notNull().default(true),
    criadoEm: timestamp('criado_em', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('usuario_email_unico').on(sql`lower(${t.email})`)],
);
