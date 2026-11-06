/* eslint-disable @typescript-eslint/require-await -- os handlers de tarefa são async por contrato, mesmo quando o teste não espera nada */
import { Pool } from 'pg';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { ErroSemRetry, Fila, type OpcoesFila } from '../src/fila/fila';
import { prepararFila } from '../src/fila/preparar-fila';
import { subirPostgres } from './postgres';

let urlDono: string;
let urlRuntime: string;
let parar: () => Promise<void>;
const filas: Fila[] = [];

const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function esperar(cond: () => boolean | Promise<boolean>, ms = 20_000): Promise<void> {
  const fim = Date.now() + ms;
  while (Date.now() < fim) {
    if (await cond()) return;
    await dormir(100);
  }
  throw new Error('condição não atendida a tempo');
}

/** Fila rápida para teste (poll de 0,5 s), conectada como o papel de RUNTIME (sem DDL). */
function criar(papel: 'api' | 'worker' | 'tudo', extra: Partial<OpcoesFila> = {}): Fila {
  const f = new Fila({ url: urlRuntime, papel, intervaloSegundos: 0.5, atrasoRetrySegundos: 1, ...extra });
  filas.push(f);
  return f;
}

beforeAll(async () => {
  ({ url: urlDono, urlRuntime, parar } = await subirPostgres());
  await prepararFila(urlDono, {
    tarefas: ['t-retry', 't-idem', 't-idem-falha', 't-falha', 't-api', 't-shutdown', 't-sem-retry', 't-agenda'],
    conceder: true,
  });
});

afterEach(async () => {
  while (filas.length > 0) await filas.pop()!.encerrar();
});

afterAll(async () => {
  await parar?.();
});

describe('fila de tarefas (pg-boss, schema fila, papel de runtime)', () => {
  it('tarefa que falha 2x e passa na 3ª conclui', async () => {
    const f = criar('tudo');
    let chamadas = 0;
    f.registrarTarefa<{ n: number }>(
      't-retry',
      async () => {
        chamadas++;
        if (chamadas < 3) throw new Error('instável');
      },
      { tentativas: 5, backoff: true },
    );
    await f.iniciar();
    await f.enviar('t-retry', { n: 1 });
    await esperar(() => chamadas >= 3, 30_000);
    await dormir(2000);
    expect(chamadas).toBe(3);
  }, 40_000);

  it('tarefa idempotente enviada 2x com a mesma chave produz 1 efeito', async () => {
    const f = criar('tudo');
    const efeitos: string[] = [];
    f.registrarTarefa<{ x: string }>('t-idem', async (d) => {
      efeitos.push(d.x);
    });
    await f.iniciar();
    await f.enviar('t-idem', { x: 'a' }, { chave: 'pedido-42' });
    await esperar(() => efeitos.length === 1);
    await f.enviar('t-idem', { x: 'a' }, { chave: 'pedido-42' });
    await f.enviar('t-idem', { x: 'b' }, { chave: 'pedido-43' });
    await esperar(() => efeitos.length === 2);
    await dormir(1500);
    expect(efeitos).toEqual(['a', 'b']);
  });

  it('a chave reservada é liberada quando a execução falha (a nova tentativa roda)', async () => {
    const f = criar('tudo');
    let n = 0;
    f.registrarTarefa('t-idem-falha', async () => {
      n++;
      if (n === 1) throw new Error('falhou');
    });
    await f.iniciar();
    await f.enviar('t-idem-falha', {}, { chave: 'k1' });
    await esperar(() => n >= 2, 30_000);
    expect(n).toBe(2);
  }, 40_000);

  it('falha definitiva chama o alerta uma vez, sem dados do payload', async () => {
    const alertas: Record<string, unknown>[] = [];
    const f = criar('tudo');
    f.definirAlerta(async (a) => {
      alertas.push({ ...a });
    });
    let chamadas = 0;
    f.registrarTarefa<{ cpf: string }>(
      't-falha',
      async () => {
        chamadas++;
        throw new Error('sempre falha');
      },
      { tentativas: 2, backoff: false },
    );
    await f.iniciar();
    await f.enviar('t-falha', { cpf: '123.456.789-09' });
    await esperar(() => alertas.length >= 1, 30_000);
    await dormir(2500);
    expect(chamadas).toBe(2);
    expect(alertas).toHaveLength(1);
    expect(alertas[0]).toMatchObject({ tarefa: 't-falha', tentativas: 2 });
    expect(JSON.stringify(alertas)).not.toContain('123.456.789-09');
  }, 40_000);

  it('ErroSemRetry vai direto para o alerta, sem repetir', async () => {
    const alertas: string[] = [];
    const f = criar('tudo');
    f.definirAlerta(async (a) => {
      alertas.push(a.tarefa);
    });
    let chamadas = 0;
    f.registrarTarefa('t-sem-retry', async () => {
      chamadas++;
      throw new ErroSemRetry('endereço inválido');
    });
    await f.iniciar();
    await f.enviar('t-sem-retry', {});
    await esperar(() => alertas.length === 1);
    await dormir(2500);
    expect(chamadas).toBe(1);
    expect(alertas).toEqual(['t-sem-retry']);
  });

  it('ROLE=api enfileira mas não consome; um worker consome depois', async () => {
    const recebidos: number[] = [];
    const api = criar('api');
    api.registrarTarefa<{ n: number }>('t-api', async (d) => {
      recebidos.push(d.n);
    });
    await api.iniciar();
    await api.enviar('t-api', { n: 7 });
    await dormir(3000);
    expect(recebidos).toEqual([]);

    const worker = criar('worker');
    worker.registrarTarefa<{ n: number }>('t-api', async (d) => {
      recebidos.push(d.n);
    });
    await worker.iniciar();
    await esperar(() => recebidos.length === 1);
    expect(recebidos).toEqual([7]);
  }, 30_000);

  it('encerramento gracioso: termina a tarefa em andamento antes de sair', async () => {
    const f = criar('tudo', { encerrarTimeoutMs: 10_000 });
    let iniciou = false;
    let terminou = false;
    f.registrarTarefa('t-shutdown', async () => {
      iniciou = true;
      await dormir(2000);
      terminou = true;
    });
    await f.iniciar();
    await f.enviar('t-shutdown', {});
    await esperar(() => iniciou);
    const t0 = Date.now();
    await f.encerrar();
    expect(terminou).toBe(true);
    expect(Date.now() - t0).toBeLessThan(10_000);
  }, 30_000);

  it('encerramento tem prazo: tarefa que não acaba não segura o processo para sempre', async () => {
    const f = criar('tudo', { encerrarTimeoutMs: 1500 });
    let iniciou = false;
    f.registrarTarefa('t-shutdown', async () => {
      iniciou = true;
      await dormir(8000);
    });
    await f.iniciar();
    await f.enviar('t-shutdown', {});
    await esperar(() => iniciou);
    const t0 = Date.now();
    await f.encerrar();
    expect(Date.now() - t0).toBeLessThan(6000);
  }, 30_000);

  it('agendar() grava a rotina (cron e fuso) quando o processo consome a fila', async () => {
    const f = criar('tudo');
    f.registrarTarefa('t-agenda', async () => {});
    f.agendar('t-agenda', '0 3 * * *', { tz: 'America/Sao_Paulo' });
    await f.iniciar();
    const pool = new Pool({ connectionString: urlDono, max: 1 });
    try {
      const r = await pool.query(`SELECT cron, timezone FROM fila.schedule WHERE name = 't-agenda'`);
      expect(r.rows).toEqual([{ cron: '0 3 * * *', timezone: 'America/Sao_Paulo' }]);
    } finally {
      await pool.end();
    }
  });

  it('o papel de runtime não tem DDL no schema fila (só DML)', async () => {
    const pool = new Pool({ connectionString: urlRuntime, max: 1 });
    try {
      await expect(pool.query('CREATE TABLE fila.intruso (id int)')).rejects.toThrow(/permission denied/i);
      await expect(pool.query('SELECT count(*) FROM fila.job')).resolves.toBeDefined();
    } finally {
      await pool.end();
    }
  });
});
