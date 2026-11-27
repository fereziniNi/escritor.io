import { sql } from 'drizzle-orm';
import { bigint, check, index, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { usuario } from '../usuarios/usuario.tabela';

/** Quem pode ver o arquivo além do dono: PRIVADO = só o dono (e ADMIN); GESTAO = também todo GESTOR. */
export const ESCOPOS = ['PRIVADO', 'GESTAO'] as const;
export type Escopo = (typeof ESCOPOS)[number];

/**
 * Metadados dos arquivos (o conteúdo fica no armazenamento). Quem vê, baixa e remove é decidido em ArquivosService com
 * `donoId` e `escopo`; o cliente nunca conhece `chave` (o nome do objeto no armazenamento, `<uuid>.<extensão>` sorteado no
 * servidor). `nomeOriginal` é só o que o usuário viu ao enviar: texto de exibição, já sem caminho nem caractere de controle,
 * nunca usado para achar o arquivo. Remover marca `removidoEm` (o objeto sai do armazenamento; a linha fica para a trilha).
 * `varredura`: LIMPO (ClamAV varreu e liberou) ou NAO_VARRIDO (antivírus desligado).
 */
export const arquivo = pgTable(
  'arquivo',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    chave: text('chave').notNull(),
    nomeOriginal: text('nome_original').notNull(),
    tipo: text('tipo').notNull(),
    tamanho: bigint('tamanho', { mode: 'number' }).notNull(),
    donoId: uuid('dono_id')
      .notNull()
      .references(() => usuario.id),
    escopo: text('escopo').notNull().default('PRIVADO'),
    varredura: text('varredura').notNull(),
    criadoEm: timestamp('criado_em', { withTimezone: true }).notNull().defaultNow(),
    removidoEm: timestamp('removido_em', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('arquivo_chave_unica').on(t.chave),
    index('arquivo_dono_criado_em').on(t.donoId, t.criadoEm),
    check('arquivo_escopo_valido', sql`${t.escopo} in ('PRIVADO', 'GESTAO')`),
    check('arquivo_varredura_valida', sql`${t.varredura} in ('LIMPO', 'NAO_VARRIDO')`),
    check('arquivo_tamanho_positivo', sql`${t.tamanho} > 0`),
  ],
);
