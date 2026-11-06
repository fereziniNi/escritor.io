// origem: skills-modelo/apps/api/src/banco/senha-runtime.ts
import { Pool, escapeIdentifier, escapeLiteral } from 'pg';

/**
 * Passo de instalação (ROLE=migrar, com o DONO do banco): dá LOGIN ao papel de runtime com a senha que está em
 * DATABASE_URL_RUNTIME. Roda a cada deploy, depois das migrações (que criam o papel app_runtime sem login): trocar a senha
 * no segredo e subir de novo é a rotação. Nunca cria papel (o nome errado na URL vira erro claro) e nunca loga a senha.
 */
export async function definirSenhaRuntime(urlDono: string, urlRuntime: string): Promise<void> {
  const runtime = new URL(urlRuntime);
  const usuario = decodeURIComponent(runtime.username);
  const senha = decodeURIComponent(runtime.password);
  if (usuario === '' || senha === '') throw new Error('DATABASE_URL_RUNTIME precisa de usuário e senha (postgres://app_runtime:SENHA@banco:5432/app)');
  if (usuario === decodeURIComponent(new URL(urlDono).username)) {
    throw new Error('DATABASE_URL_RUNTIME não pode usar o mesmo usuário de DATABASE_URL (o dono ignora o REVOKE da auditoria)');
  }
  const pool = new Pool({ connectionString: urlDono, max: 1 });
  try {
    const existe = await pool.query('SELECT 1 FROM pg_roles WHERE rolname = $1', [usuario]);
    if (existe.rowCount !== 1) {
      throw new Error(`o papel de runtime "${usuario}" não existe no banco (as migrações criam app_runtime; confira o usuário de DATABASE_URL_RUNTIME)`);
    }
    // ALTER ROLE não aceita parâmetro ($1): identificador e literal escapados pelo próprio driver.
    await pool.query(`ALTER ROLE ${escapeIdentifier(usuario)} LOGIN PASSWORD ${escapeLiteral(senha)}`);
  } finally {
    await pool.end();
  }
}
