// origem: skills-modelo/apps/api/test/lgpd.e2e.spec.ts
import { randomBytes } from 'node:crypto';
import { type INestApplication } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { BANCO, type Db, criarBanco } from '../src/banco/banco';
import { usuario } from '../src/banco/esquema';
import { COLUNA_CPF } from '../src/clientes/cliente.tabela';
import { type Config, carregarConfig } from '../src/config/config';
import { criarApp } from '../src/criar-app';
import { Chaveiro, lerChavesDados } from '../src/lgpd/chaveiro';
import { recifrarClientes } from '../src/lgpd/recifrar';
import { executarRetencao, expurgarIpAuditoria } from '../src/lgpd/retencao';
import { subirPostgres } from './postgres';
import { comoUsuario, exporUsuarioDeTeste } from './usuario-de-teste';

const PAINEL = 'https://painel.exemplo.com.br';
const MALICIOSO = 'https://malicioso.exemplo.com';
const CPF = '12345678909';
const CPF_FORMATADO = '123.456.789-09';
const OUTRO_CPF = '52998224725';
const EMAIL = 'ana.souza@exemplo.com.br';

const chave = () => randomBytes(32).toString('base64');
const CHAVE_ANTIGA = chave();
const CHAVES = { DADOS_CHAVES: `k1:${CHAVE_ANTIGA}`, DADOS_CHAVE_INDICE: chave() };

let urlDono: string;
let urlRuntime: string;
let parar: () => Promise<void>;
let dono: Pool;
let app: INestApplication;
let db: Db;
let config: Config;
const logs: string[] = [];

type Linha = typeof usuario.$inferSelect;
let admin: Linha;
let gestor: Linha;
let comum: Linha;

const http = () => request(app.getHttpServer());
const cab = (u: Linha) => comoUsuario(u);
const DIA = 24 * 60 * 60 * 1000;

async function criarUsuario(email: string, papel: 'ADMIN' | 'GESTOR' | 'USUARIO'): Promise<Linha> {
  const [linha] = await db.insert(usuario).values({ email, nome: 'Fulana', papel, ativo: true }).returning();
  return linha!;
}

async function criarCliente(cpf: string, extra: { nome?: string; email?: string } = {}) {
  const res = await http()
    .post('/api/clientes')
    .set('x-usuario-teste', cab(gestor))
    .set('Origin', PAINEL)
    .send({ nome: extra.nome ?? 'Ana Souza', email: extra.email ?? EMAIL, cpf });
  expect(res.status).toBe(201);
  return res.body as { id: string; nome: string; email: string | null; cpf: string | null };
}

async function eventosDe(acao: string) {
  return (await dono.query('select * from evento_auditoria where acao = $1 order by id desc', [acao])).rows as Record<string, unknown>[];
}

beforeAll(async () => {
  ({ url: urlDono, urlRuntime, parar } = await subirPostgres());
  dono = new Pool({ connectionString: urlDono, max: 2 });
  config = carregarConfig({
    DATABASE_URL: urlDono,
    DATABASE_URL_RUNTIME: urlRuntime,
    NODE_ENV: 'test',
    LOG_LEVEL: 'info',
    CORS_ORIGENS: PAINEL,
    ...CHAVES,
  });
  app = await criarApp(config, { destinoLog: { write: (l: string) => void logs.push(l) } });
  exporUsuarioDeTeste(app);
  await app.init();
  db = app.get<Db>(BANCO);
  admin = await criarUsuario('admin@exemplo.com.br', 'ADMIN');
  gestor = await criarUsuario('gestor@exemplo.com.br', 'GESTOR');
  comum = await criarUsuario('comum@exemplo.com.br', 'USUARIO');
});

afterAll(async () => {
  await app?.close().catch(() => undefined);
  await dono?.end().catch(() => undefined);
  await parar?.();
});

describe('cliente com CPF cifrado (AES-256-GCM) e índice cego (HMAC)', () => {
  it('cria o cliente e o banco não guarda o CPF em claro', async () => {
    const c = await criarCliente(CPF_FORMATADO);
    expect(c.cpf).toBe(CPF);
    const { rows } = await dono.query('select * from cliente where id = $1', [c.id]);
    const linha = rows[0] as Record<string, string>;
    expect(JSON.stringify(rows)).not.toContain(CPF);
    expect(JSON.stringify(rows)).not.toContain(CPF_FORMATADO);
    expect(linha['cpf_cifrado']!.startsWith('k1:')).toBe(true);
    expect(linha['cpf_indice']).toMatch(/^[0-9a-f]{64}$/);
  });

  it('o banco recusa CPF em claro na coluna cifrada (CHECK)', async () => {
    await expect(
      dono.query("insert into cliente (nome, cpf_cifrado, cpf_indice) values ('X', '12345678909', repeat('a', 64))"),
    ).rejects.toMatchObject({ code: '23514' });
  });

  it('CPF inválido → 400; mesmo CPF (em outro formato) → 409', async () => {
    await http().post('/api/clientes').set('x-usuario-teste', cab(gestor)).set('Origin', PAINEL).send({ nome: 'X', cpf: '12345678900' }).expect(400);
    await http().post('/api/clientes').set('x-usuario-teste', cab(gestor)).set('Origin', PAINEL).send({ nome: 'X', cpf: CPF }).expect(409);
  });

  it('busca por CPF pelo índice cego (CPF no corpo, nunca na URL)', async () => {
    const res = await http().post('/api/clientes/busca-cpf').set('x-usuario-teste', cab(gestor)).set('Origin', PAINEL).send({ cpf: CPF_FORMATADO }).expect(200);
    expect(res.body.cpf).toBe(CPF);
    await http().post('/api/clientes/busca-cpf').set('x-usuario-teste', cab(gestor)).set('Origin', PAINEL).send({ cpf: OUTRO_CPF }).expect(404);
  });

  it('sem sessão → 401', async () => {
    await http().get('/api/clientes').expect(401);
  });
});

describe('máscara por papel (interceptor): só GESTOR e ADMIN veem CPF e e-mail completos', () => {
  it('USUARIO vê CPF e e-mail mascarados, no item e na lista', async () => {
    const c = await criarCliente(OUTRO_CPF, { email: 'bia@exemplo.com.br' });
    const um = await http().get(`/api/clientes/${c.id}`).set('x-usuario-teste', cab(comum)).expect(200);
    expect(um.body).toMatchObject({ id: c.id, cpf: '***.982.247-**', email: 'b***@exemplo.com.br' });
    const lista = await http().get('/api/clientes').set('x-usuario-teste', cab(comum)).expect(200);
    expect(JSON.stringify(lista.body)).not.toContain(OUTRO_CPF);
    expect(JSON.stringify(lista.body)).not.toContain('bia@exemplo.com.br');
  });

  it('GESTOR e ADMIN veem completo', async () => {
    const lista = await http().get('/api/clientes').set('x-usuario-teste', cab(gestor)).expect(200);
    expect(JSON.stringify(lista.body)).toContain(OUTRO_CPF);
    const deAdmin = await http().get('/api/clientes').set('x-usuario-teste', cab(admin)).expect(200);
    expect(JSON.stringify(deAdmin.body)).toContain('bia@exemplo.com.br');
  });

  it('o próprio registro do usuário não é mascarado (perfil "eu")', async () => {
    const eu = await http().get('/api/usuarios/eu').set('x-usuario-teste', cab(comum)).expect(200);
    expect(eu.body.email).toBe('comum@exemplo.com.br');
  });
});

describe('direitos do titular: exportar e anonimizar (só ADMIN, auditado)', () => {
  let alvo: { id: string };

  beforeAll(async () => {
    alvo = await criarCliente('39053344705', { nome: 'Carla Titular', email: 'carla@exemplo.com.br' });
  });

  it('exportar: 401 sem sessão, 403 GESTOR e USUARIO', async () => {
    await http().get(`/api/admin/lgpd/titulares/${alvo.id}/exportar`).expect(401);
    await http().get(`/api/admin/lgpd/titulares/${alvo.id}/exportar`).set('x-usuario-teste', cab(gestor)).expect(403);
    await http().get(`/api/admin/lgpd/titulares/${alvo.id}/exportar`).set('x-usuario-teste', cab(comum)).expect(403);
  });

  it('exportar: ADMIN recebe os dados completos em anexo, sem cache, e fica registrado (sem dado pessoal na trilha)', async () => {
    const res = await http().get(`/api/admin/lgpd/titulares/${alvo.id}/exportar`).set('x-usuario-teste', cab(admin)).expect(200);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.headers['content-disposition']).toMatch(/attachment; filename="titular-.+\.json"/);
    expect(res.body).toMatchObject({ titular: { id: alvo.id, nome: 'Carla Titular', email: 'carla@exemplo.com.br', cpf: '39053344705' } });
    const [evento] = await eventosDe('lgpd.exportar_titular');
    expect(evento).toMatchObject({ ator_id: admin.id, alvo_tipo: 'cliente', alvo_id: alvo.id });
    expect(JSON.stringify(evento)).not.toContain('39053344705');
    expect(JSON.stringify(evento)).not.toContain('Carla');
  });

  it('exportar vindo de outro site (Sec-Fetch-Site) → 403', async () => {
    await http()
      .get(`/api/admin/lgpd/titulares/${alvo.id}/exportar`)
      .set('x-usuario-teste', cab(admin))
      .set('Sec-Fetch-Site', 'cross-site')
      .expect(403);
  });

  it('anonimizar: guarda de origem (Origin de outro site → 403) e só ADMIN', async () => {
    await http().post(`/api/admin/lgpd/titulares/${alvo.id}/anonimizar`).set('x-usuario-teste', cab(admin)).set('Origin', MALICIOSO).expect(403);
    await http().post(`/api/admin/lgpd/titulares/${alvo.id}/anonimizar`).set('x-usuario-teste', cab(gestor)).set('Origin', PAINEL).expect(403);
    const { rows } = await dono.query('select nome from cliente where id = $1', [alvo.id]);
    expect(rows[0].nome).toBe('Carla Titular');
  });

  it('anonimizar troca nome/e-mail/CPF e mantém id; o CPF antigo some da busca; fica registrado', async () => {
    const res = await http().post(`/api/admin/lgpd/titulares/${alvo.id}/anonimizar`).set('x-usuario-teste', cab(admin)).set('Origin', PAINEL).expect(200);
    expect(res.body).toMatchObject({ id: alvo.id, nome: 'Titular anonimizado', email: null, cpf: null });
    expect(res.body.anonimizadoEm).toEqual(expect.any(String));
    const { rows } = await dono.query('select * from cliente where id = $1', [alvo.id]);
    expect(rows[0]).toMatchObject({ id: alvo.id, nome: 'Titular anonimizado', email: null, cpf_cifrado: null, cpf_indice: null });
    await http().post('/api/clientes/busca-cpf').set('x-usuario-teste', cab(gestor)).set('Origin', PAINEL).send({ cpf: '39053344705' }).expect(404);
    const [evento] = await eventosDe('lgpd.anonimizar_titular');
    expect(evento).toMatchObject({ ator_id: admin.id, alvo_id: alvo.id });
    expect(JSON.stringify(evento)).not.toContain('Carla');
    // de novo: 409, sem novo evento
    await http().post(`/api/admin/lgpd/titulares/${alvo.id}/anonimizar`).set('x-usuario-teste', cab(admin)).set('Origin', PAINEL).expect(409);
    expect((await eventosDe('lgpd.anonimizar_titular')).length).toBe(1);
    // o CPF fica livre para um cadastro novo
    await criarCliente('39053344705');
  });

  it('id inexistente → 404', async () => {
    await http().get('/api/admin/lgpd/titulares/00000000-0000-4000-8000-000000000000/exportar').set('x-usuario-teste', cab(admin)).expect(404);
  });
});

describe('retenção (RETENCAO_DIAS) — comando pnpm --filter api lgpd:retencao', () => {
  it('encerrar cliente: GESTOR/ADMIN, auditado; USUARIO 403', async () => {
    const c = await criarCliente('11144477735');
    await http().post(`/api/clientes/${c.id}/encerrar`).set('x-usuario-teste', cab(comum)).set('Origin', PAINEL).expect(403);
    const res = await http().post(`/api/clientes/${c.id}/encerrar`).set('x-usuario-teste', cab(gestor)).set('Origin', PAINEL).expect(200);
    expect(res.body.encerradoEm).toEqual(expect.any(String));
    expect((await eventosDe('cliente.encerrar'))[0]).toMatchObject({ ator_id: gestor.id, alvo_id: c.id });
  });

  it('sem RETENCAO_DIAS não expurga nada', async () => {
    const runtime = criarBanco(urlRuntime);
    try {
      expect(await executarRetencao({ db: runtime, config })).toEqual({ ligada: false, clientes: 0, codigos: 0, sessoes: 0 });
    } finally {
      await runtime.$client.end();
    }
  });

  it('anonimiza cliente encerrado há mais de N dias, apaga códigos e sessões antigos; o resto fica', async () => {
    const agora = new Date();
    const velho = await criarCliente('93541134780', { nome: 'Velho Encerrado' });
    const recente = await criarCliente('71428793860', { nome: 'Recente Encerrado' });
    const ativo = await criarCliente('28625587887', { nome: 'Ativo' });
    await dono.query('update cliente set encerrado_em = $2 where id = $1', [velho.id, new Date(agora.getTime() - 40 * DIA)]);
    await dono.query('update cliente set encerrado_em = $2 where id = $1', [recente.id, new Date(agora.getTime() - 10 * DIA)]);
    await dono.query("insert into codigo_login (email, hmac, expira_em, criado_em) values ('x@exemplo.com.br', 'h', $1, $1), ('y@exemplo.com.br', 'h', now(), now())", [
      new Date(agora.getTime() - 40 * DIA),
    ]);
    await dono.query("insert into sessao (hash_token, usuario_id, criada_em, ultimo_uso_em) values ('velha', $1, $2, $2), ('nova', $1, now(), now())", [
      comum.id,
      new Date(agora.getTime() - 40 * DIA),
    ]);

    const runtime = criarBanco(urlRuntime);
    try {
      const r = await executarRetencao({ db: runtime, config: { ...config, RETENCAO_DIAS: 30 }, agora });
      expect(r).toEqual({ ligada: true, clientes: 1, codigos: 1, sessoes: 1 });
    } finally {
      await runtime.$client.end();
    }
    const nomes = (await dono.query('select id, nome from cliente where id = any($1)', [[velho.id, recente.id, ativo.id]])).rows as { id: string; nome: string }[];
    expect(Object.fromEntries(nomes.map((n) => [n.id, n.nome]))).toEqual({
      [velho.id]: 'Titular anonimizado',
      [recente.id]: 'Recente Encerrado',
      [ativo.id]: 'Ativo',
    });
    expect((await dono.query("select count(*)::int as n from codigo_login where email = 'y@exemplo.com.br'")).rows[0].n).toBe(1);
    expect((await dono.query("select count(*)::int as n from sessao where hash_token in ('velha', 'nova')")).rows[0].n).toBe(1);
    const [evento] = await eventosDe('lgpd.anonimizar_titular');
    expect(evento).toMatchObject({ ator_id: null, alvo_id: velho.id, depois: { motivo: 'retencao' } });
    expect((await eventosDe('lgpd.retencao'))[0]).toMatchObject({ depois: { clientes: 1, pedidosLogin: 1, sessoes: 1, dias: 30 } });
  });
});

describe('expurgo do IP da trilha (RETENCAO_AUDITORIA_IP_DIAS): só com o dono, nunca com o runtime', () => {
  const antigo = new Date(Date.now() - 400 * DIA);

  beforeAll(async () => {
    await dono.query("insert into evento_auditoria (ocorrido_em, acao, ip) values ($1, 'teste.ip_antigo', '203.0.113.7'), (now(), 'teste.ip_recente', '203.0.113.8')", [antigo]);
  });

  it('com o papel de runtime falha (não é dono) e nada muda; o gatilho continua ligado', async () => {
    const runtime = criarBanco(urlRuntime);
    try {
      await expect(expurgarIpAuditoria(runtime, 365)).rejects.toThrow();
    } finally {
      await runtime.$client.end();
    }
    expect((await eventosDe('teste.ip_antigo'))[0]!['ip']).toBe('203.0.113.7');
    const gatilho = await dono.query("select tgenabled from pg_trigger where tgname = 'evento_auditoria_sem_alteracao'");
    expect(gatilho.rows[0].tgenabled).toBe('O');
  });

  it('com o dono: apaga só o IP dos eventos antigos, registra auditoria.expurgo e o gatilho volta a valer', async () => {
    const donoDb = criarBanco(urlDono);
    try {
      expect(await expurgarIpAuditoria(donoDb, 365)).toBe(1);
    } finally {
      await donoDb.$client.end();
    }
    expect((await eventosDe('teste.ip_antigo'))[0]!['ip']).toBeNull();
    expect((await eventosDe('teste.ip_recente'))[0]!['ip']).toBe('203.0.113.8');
    expect((await eventosDe('auditoria.expurgo'))[0]).toMatchObject({ ator_id: null, depois: { campo: 'ip', linhas: 1, dias: 365 } });
    const gatilho = await dono.query("select tgenabled from pg_trigger where tgname = 'evento_auditoria_sem_alteracao'");
    expect(gatilho.rows[0].tgenabled).toBe('O');
    await expect(dono.query("update evento_auditoria set ip = null where acao = 'teste.ip_recente'")).rejects.toThrow(/imutável/);
  });
});

describe('rotação de chave: recifrar (pnpm --filter api lgpd:recifrar)', () => {
  it('com a chave nova na frente, re-cifra o que usa a antiga; tudo continua legível', async () => {
    const novo = new Chaveiro(lerChavesDados(`k2:${chave()},k1:${CHAVE_ANTIGA}`));
    const antes = (await dono.query('select id, cpf_cifrado from cliente where cpf_cifrado is not null')).rows as { id: string; cpf_cifrado: string }[];
    expect(antes.length).toBeGreaterThan(0);
    const claros = Object.fromEntries(antes.map((l) => [l.id, novo.decifrar(l.cpf_cifrado, COLUNA_CPF)]));
    const runtime = criarBanco(urlRuntime);
    try {
      expect(await recifrarClientes(runtime, novo)).toBe(antes.length);
      expect(await recifrarClientes(runtime, novo)).toBe(0);
    } finally {
      await runtime.$client.end();
    }
    const depois = (await dono.query('select id, cpf_cifrado from cliente where cpf_cifrado is not null')).rows as { id: string; cpf_cifrado: string }[];
    for (const l of depois) {
      expect(l.cpf_cifrado.startsWith('k2:')).toBe(true);
      expect(novo.decifrar(l.cpf_cifrado, COLUNA_CPF)).toBe(claros[l.id]);
    }
  });
});

describe('logs sem dado pessoal', () => {
  it('log com CPF sai mascarado (pino redact + varredura no destino)', () => {
    const logger = app.get(Logger);
    logger.log(`cliente ${CPF_FORMATADO} conferido`);
    logger.warn({ cliente: { cpf: CPF, email: EMAIL } }, 'teste');
    const tudo = logs.join('');
    expect(tudo).toContain('***.456.789-**');
    expect(tudo).toContain('[REDACTED]');
  });

  it('nenhuma linha de log de toda a bateria contém CPF ou e-mail de cliente em claro', () => {
    const tudo = logs.join('');
    expect(logs.length).toBeGreaterThan(10);
    for (const proibido of [CPF, CPF_FORMATADO, OUTRO_CPF, '390.533.447-05', '39053344705', EMAIL, 'carla@exemplo.com.br']) {
      expect(tudo).not.toContain(proibido);
    }
  });
});
