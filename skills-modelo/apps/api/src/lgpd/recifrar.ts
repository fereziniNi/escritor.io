import { and, asc, eq, gt, isNotNull, like, not } from 'drizzle-orm';
import { type Db } from '../banco/banco';
import { cliente } from '../banco/esquema';
import { COLUNA_CPF } from '../clientes/cliente.tabela';
import { type Chaveiro } from './chaveiro';

/** Linhas por lote: a memória não cresce com o tamanho da tabela. */
export const LOTE_RECIFRAR = 500;

/**
 * Rotação de chave (comando `pnpm --filter api lgpd:recifrar`): re-cifra com a chave ATIVA (a primeira de DADOS_CHAVES)
 * todo CPF que ainda está numa chave antiga. Passo 2 de 3: (1) ponha a chave nova na frente de DADOS_CHAVES e reinicie a
 * API; (2) rode este comando; (3) só então retire a chave antiga. Idempotente; devolve quantas linhas mudou.
 * Em lotes de `tamanhoLote` por paginação de chave (`id > último id`, em ordem de id): não carrega a tabela inteira e
 * não pula nem repete linha mesmo com inserções durante a execução.
 * O índice cego não muda (DADOS_CHAVE_INDICE não roda junto). Entidade nova com coluna cifrada entra aqui também.
 */
export async function recifrarClientes(db: Db, chaveiro: Chaveiro, tamanhoLote = LOTE_RECIFRAR): Promise<number> {
  let mudou = 0;
  let ultimoId: string | undefined;
  for (;;) {
    const lote = await db
      .select({ id: cliente.id, cpfCifrado: cliente.cpfCifrado })
      .from(cliente)
      .where(
        and(
          isNotNull(cliente.cpfCifrado),
          not(like(cliente.cpfCifrado, `${chaveiro.kidAtivo}:%`)),
          ultimoId === undefined ? undefined : gt(cliente.id, ultimoId),
        ),
      )
      .orderBy(asc(cliente.id))
      .limit(tamanhoLote);
    for (const { id, cpfCifrado } of lote) {
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
    if (lote.length < tamanhoLote) return mudou;
    ultimoId = lote[lote.length - 1]!.id;
  }
}
