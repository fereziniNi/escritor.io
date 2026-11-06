import { and, eq, isNotNull, not, like } from 'drizzle-orm';
import { type Db } from '../banco/banco';
import { cliente } from '../banco/esquema';
import { COLUNA_CPF } from '../clientes/cliente.tabela';
import { type Chaveiro } from './chaveiro';

/**
 * Rotação de chave (comando `pnpm --filter api lgpd:recifrar`): re-cifra com a chave ATIVA (a primeira de DADOS_CHAVES)
 * todo CPF que ainda está numa chave antiga. Passo 2 de 3: (1) ponha a chave nova na frente de DADOS_CHAVES e reinicie a
 * API; (2) rode este comando; (3) só então retire a chave antiga. Idempotente; devolve quantas linhas mudou.
 * O índice cego não muda (DADOS_CHAVE_INDICE não roda junto). Entidade nova com coluna cifrada entra aqui também.
 */
export async function recifrarClientes(db: Db, chaveiro: Chaveiro): Promise<number> {
  const pendentes = await db
    .select({ id: cliente.id, cpfCifrado: cliente.cpfCifrado })
    .from(cliente)
    .where(and(isNotNull(cliente.cpfCifrado), not(like(cliente.cpfCifrado, `${chaveiro.kidAtivo}:%`))));
  let mudou = 0;
  for (const { id, cpfCifrado } of pendentes) {
    const novo = chaveiro.recifrar(cpfCifrado!, COLUNA_CPF);
    if (novo === null) continue;
    // Só troca se ninguém mudou a linha no meio (anonimizada ou re-cifrada por outra execução).
    const r = await db
      .update(cliente)
      .set({ cpfCifrado: novo })
      .where(and(eq(cliente.id, id), eq(cliente.cpfCifrado, cpfCifrado!)))
      .returning({ id: cliente.id });
    mudou += r.length;
  }
  return mudou;
}
