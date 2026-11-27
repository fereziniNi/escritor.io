import PgBoss from 'pg-boss';
import { Pool } from 'pg';
import { FILAS_DO_SISTEMA } from './catalogo';

export const SCHEMA_FILA = 'fila';

export interface OpcoesPreparo {
  /** Filas a garantir além das do catálogo (testes e tarefas ainda fora de `catalogo.ts`). */
  tarefas?: readonly string[];
  /** Concede ao papel de runtime só o DML de que ele precisa no schema `fila`. */
  conceder?: boolean;
  /** Papel de runtime (skill trilha-auditoria). Se não existir no servidor, a concessão é pulada. */
  papelRuntime?: string;
}

/**
 * Passo de migração da fila, SEMPRE com o DONO do banco (DATABASE_URL): cria/atualiza o schema `fila` do pg-boss, cria as
 * filas, a tabela `fila.efeito_unico` (chaves de idempotência) e concede ao papel de runtime SELECT/INSERT/UPDATE/DELETE
 * no schema (sem DDL). Idempotente: pode rodar a cada deploy.
 */
export async function prepararFila(urlDono: string, opcoes: OpcoesPreparo = {}): Promise<void> {
  const { tarefas = [], conceder = false, papelRuntime = 'app_runtime' } = opcoes;
  const boss = new PgBoss({ connectionString: urlDono, schema: SCHEMA_FILA, max: 2, migrate: true, supervise: false, schedule: false });
  boss.on('error', () => {});
  await boss.start();
  try {
    const nomes = new Set([...Object.keys(FILAS_DO_SISTEMA), ...tarefas]);
    for (const nome of nomes) {
      // Cópia: o createQueue do pg-boss acrescenta campos (policy...) ao objeto recebido e o updateQueue recusa esses campos.
      const opcoesFila = { ...FILAS_DO_SISTEMA[nome] };
      if ((await boss.getQueue(nome)) === null) await boss.createQueue(nome, opcoesFila);
      else if (Object.keys(opcoesFila).length > 0) await boss.updateQueue(nome, { ...FILAS_DO_SISTEMA[nome] });
    }
  } finally {
    await boss.stop({ graceful: true, wait: true, timeout: 10_000 });
  }
  const pool = new Pool({ connectionString: urlDono, max: 1 });
  try {
    await pool.query(`CREATE TABLE IF NOT EXISTS ${SCHEMA_FILA}.efeito_unico (
      chave text PRIMARY KEY,
      iniciado_em timestamptz NOT NULL DEFAULT now(),
      concluido_em timestamptz
    )`);
    if (conceder) {
      const existe = await pool.query('SELECT 1 FROM pg_roles WHERE rolname = $1', [papelRuntime]);
      if (existe.rowCount === 1) {
        const papel = `"${papelRuntime.replaceAll('"', '""')}"`;
        for (const sql of [
          `GRANT USAGE ON SCHEMA ${SCHEMA_FILA} TO ${papel}`,
          `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA ${SCHEMA_FILA} TO ${papel}`,
          `GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA ${SCHEMA_FILA} TO ${papel}`,
          `GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA ${SCHEMA_FILA} TO ${papel}`,
          // Tabelas de filas criadas depois (por este mesmo passo) já nascem com o DML.
          `ALTER DEFAULT PRIVILEGES IN SCHEMA ${SCHEMA_FILA} GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${papel}`,
        ]) {
          await pool.query(sql);
        }
      }
    }
  } finally {
    await pool.end();
  }
}
