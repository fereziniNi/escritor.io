// Passo de migração da instalação (ROLE=migrar, skill instalacao-docker-compose): o DONO dá login ao papel de runtime com a
// senha que está em DATABASE_URL_RUNTIME. Assim a TI só gera os segredos; ninguém roda ALTER ROLE à mão.
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { definirSenhaRuntime } from '../src/banco/senha-runtime';
import { subirPostgres } from './postgres';

let urlDono: string;
let urlRuntime: string;
let parar: () => Promise<void>;

/** Papel exclusivo deste arquivo (papel é do servidor inteiro: não mexer na senha do app_runtime dos outros testes). */
const PAPEL = 'runtime_senha_teste';

async function executar(url: string, sql: string): Promise<void> {
  const pool = new Pool({ connectionString: url, max: 1 });
  try {
    await pool.query(sql);
  } finally {
    await pool.end();
  }
}

const urlCom = (base: string, usuario: string, senha: string): string => {
  const u = new URL(base);
  u.username = usuario;
  u.password = encodeURIComponent(senha);
  return u.toString();
};

async function conecta(url: string): Promise<boolean> {
  const pool = new Pool({ connectionString: url, max: 1 });
  try {
    await pool.query('select 1');
    return true;
  } catch {
    return false;
  } finally {
    await pool.end();
  }
}

beforeAll(async () => {
  ({ url: urlDono, urlRuntime, parar } = await subirPostgres());
  await executar(urlDono, `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${PAPEL}') THEN CREATE ROLE ${PAPEL} NOLOGIN; END IF; END $$`);
});

afterAll(async () => {
  await parar();
});

describe('definirSenhaRuntime', () => {
  it('dá login ao papel com a senha da URL de runtime (inclusive aspas e caracteres especiais)', async () => {
    const senha = `s'en"ha:@/${Date.now()}`;
    const url = urlCom(urlDono, PAPEL, senha);
    expect(await conecta(url)).toBe(false);
    await definirSenhaRuntime(urlDono, url);
    expect(await conecta(url)).toBe(true);
  });

  it('troca a senha a cada execução (rotação): a antiga deixa de valer', async () => {
    const antiga = urlCom(urlDono, PAPEL, 'antiga-123');
    const nova = urlCom(urlDono, PAPEL, 'nova-456');
    await definirSenhaRuntime(urlDono, antiga);
    await definirSenhaRuntime(urlDono, nova);
    expect(await conecta(nova)).toBe(true);
    expect(await conecta(antiga)).toBe(false);
  });

  it('é idempotente com o app_runtime das migrações', async () => {
    await definirSenhaRuntime(urlDono, urlRuntime);
    expect(await conecta(urlRuntime)).toBe(true);
  });

  it('papel inexistente: erro claro, sem criar o papel nem mostrar a senha', async () => {
    const url = urlCom(urlDono, 'papel_que_nao_existe', 'segredo-que-nao-aparece');
    await expect(definirSenhaRuntime(urlDono, url)).rejects.toThrow(/papel_que_nao_existe.*não existe/);
    await expect(definirSenhaRuntime(urlDono, url)).rejects.not.toThrow(/segredo-que-nao-aparece/);
  });

  it('recusa usar o próprio dono como runtime', async () => {
    await expect(definirSenhaRuntime(urlDono, urlDono)).rejects.toThrow(/mesmo usuário/);
  });
});
