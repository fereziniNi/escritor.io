import { sql } from 'drizzle-orm';
import { check, index, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

/** Nome da coluna do CPF: é a AAD da cifra e o contexto do índice cego. Mudar o nome = re-cifrar e recalcular tudo. */
export const COLUNA_CPF = 'cliente.cpf';

/**
 * Exemplo de entidade com dado pessoal (skill lgpd-dados-pessoais). O CPF NUNCA fica em claro:
 * - `cpf_cifrado`: AES-256-GCM (`kid:iv:tag:cifra`, lgpd/chaveiro.ts), aberto só na API;
 * - `cpf_indice`: HMAC-SHA256 (lgpd/indice-cego.ts) do CPF só com dígitos, para buscar e para a unicidade.
 * O banco recusa CPF em claro (CHECK do formato do envelope) e cifra sem índice. Anonimizar (direito do titular ou
 * retenção) troca nome, e-mail e CPF e mantém o `id` (as referências de outras tabelas continuam valendo).
 */
export const cliente = pgTable(
  'cliente',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    nome: text('nome').notNull(),
    email: text('email'),
    cpfCifrado: text('cpf_cifrado'),
    cpfIndice: text('cpf_indice'),
    criadoEm: timestamp('criado_em', { withTimezone: true }).notNull().defaultNow(),
    /** Fim do relacionamento: a retenção (RETENCAO_DIAS) conta a partir daqui. */
    encerradoEm: timestamp('encerrado_em', { withTimezone: true }),
    anonimizadoEm: timestamp('anonimizado_em', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('cliente_cpf_indice_unico').on(t.cpfIndice),
    index('cliente_encerrado_em').on(t.encerradoEm),
    check('cliente_cpf_cifrado_formato', sql`${t.cpfCifrado} ~ '^[a-z0-9][a-z0-9-]{0,31}:[A-Za-z0-9+/]+=*:[A-Za-z0-9+/]+=*:[A-Za-z0-9+/]+=*$'`),
    check('cliente_cpf_indice_formato', sql`${t.cpfIndice} ~ '^[0-9a-f]{64}$'`),
    check('cliente_cpf_com_indice', sql`(${t.cpfCifrado} is null) = (${t.cpfIndice} is null)`),
  ],
);
