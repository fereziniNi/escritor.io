import { randomUUID } from 'node:crypto';
import { type INestApplication } from '@nestjs/common';
import { desc, sql } from 'drizzle-orm';
import { Pool } from 'pg';
import request, { type Response } from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { AuditoriaService } from '../src/auditoria/auditoria.service';
import { BANCO, type Db } from '../src/banco/banco';
import { eventoAuditoria, usuario } from '../src/banco/esquema';
import { carregarConfig } from '../src/config/config';
import { criarApp } from '../src/criar-app';
import { EmailModule } from '../src/email/email.module';
import { ServicoEmail } from '../src/email/servico-email';
import { subirPostgres } from './postgres';
import { comoUsuario, exporUsuarioDeTeste } from './usuario-de-teste';

const PAINEL = 'https://painel.exemplo.com.br';
const SEGREDO = 'segredo-do-codigo-de-teste-com-mais-de-32-caracteres';

let urlDono: string;
let urlRuntime: string;
let parar: () => Promise<void>;
let dono: Pool;
let runtime: Pool;
let app: INestApplication;
let db: Db;
let auditoria: AuditoriaService;
let enviados: { texto: string }[];

type Linha = typeof usuario.$inferSelect;
let admin: Linha;
let gestor: Linha;
let comum: Linha;

const cab = (u: Linha) => comoUsuario(u);

async function criarUsuario(email: string, papel: 'ADMIN' | 'GESTOR' | 'USUARIO', nome = 'Fulana'): Promise<Linha> {
  const [linha] = await db.insert(usuario).values({ email, nome, papel, ativo: true }).returning();
  return linha!;
}

/** Eventos de uma ação, do mais novo para o mais velho (leitura direta no banco, como o dono). */
async function eventosDe(acao: string) {
  return (await dono.query('select * from evento_auditoria where acao = $1 order by id desc', [acao])).rows as Record<string, unknown>[];
}

const total = async (acao: string) => (await eventosDe(acao)).length;

async function semear(linhas: { atorId: string | null; acao: string; quando: string; alvoId?: string }[]): Promise<void> {
  for (const l of linhas) {
    await dono.query('insert into evento_auditoria (ocorrido_em, ator_id, acao, alvo_tipo, alvo_id) values ($1, $2, $3, $4, $5)', [
      l.quando,
      l.atorId,
      l.acao,
      'teste',
      l.alvoId ?? null,
    ]);
  }
}

beforeAll(async () => {
  ({ url: urlDono, urlRuntime, parar } = await subirPostgres());
  dono = new Pool({ connectionString: urlDono, max: 2 });
  // O papel app_runtime ganha login uma vez por servidor em test/setup-global.ts; as migrações dão os privilégios.
  runtime = new Pool({ connectionString: urlRuntime, max: 2 });

  const config = carregarConfig({
    DATABASE_URL: urlDono,
    DATABASE_URL_RUNTIME: urlRuntime,
    NODE_ENV: 'test',
    LOG_LEVEL: 'silent',
    CORS_ORIGENS: PAINEL,
    AUTH_SEGREDO_CODIGO: SEGREDO,
  });
  app = await criarApp(config);
  exporUsuarioDeTeste(app);
  await app.init();
  enviados = [];
  vi.spyOn(app.select(EmailModule).get(ServicoEmail), 'disparar').mockImplementation((m) => {
    enviados.push({ texto: m.texto });
  });
  db = app.get<Db>(BANCO);
  auditoria = app.get(AuditoriaService);
  admin = await criarUsuario('admin@exemplo.com.br', 'ADMIN', 'Ana Admin');
  gestor = await criarUsuario('gestor@exemplo.com.br', 'GESTOR');
  comum = await criarUsuario('comum@exemplo.com.br', 'USUARIO');
});

afterAll(async () => {
  await app?.close().catch(() => undefined);
  await runtime?.end().catch(() => undefined);
  await dono?.end().catch(() => undefined);
  await parar?.();
});

describe('a tabela evento_auditoria é imutável', () => {
  it('a API roda com o papel de runtime (DATABASE_URL_RUNTIME), não com o dono', async () => {
    const r = await db.execute<{ quem: string }>(sql`select current_user as quem`);
    expect(r.rows[0]?.quem).toBe('app_runtime');
  });

  it('colunas da tabela', async () => {
    const r = await dono.query("select column_name from information_schema.columns where table_name = 'evento_auditoria' order by ordinal_position");
    expect((r.rows as { column_name: string }[]).map((l) => l.column_name)).toEqual([
      'id',
      'ocorrido_em',
      'ator_id',
      'acao',
      'alvo_tipo',
      'alvo_id',
      'antes',
      'depois',
      'ip',
      'request_id',
    ]);
  });

  it('papel de runtime: INSERT e SELECT funcionam', async () => {
    await runtime.query("insert into evento_auditoria (acao) values ('teste.imutavel')");
    const r = await runtime.query("select count(*)::int as n from evento_auditoria where acao = 'teste.imutavel'");
    expect(r.rows[0].n).toBe(1);
  });

  it('papel de runtime: UPDATE, DELETE e TRUNCATE falham com permissão negada (REVOKE)', async () => {
    await expect(runtime.query("update evento_auditoria set acao = 'x'")).rejects.toMatchObject({ code: '42501' });
    await expect(runtime.query('delete from evento_auditoria')).rejects.toMatchObject({ code: '42501' });
    await expect(runtime.query('truncate evento_auditoria')).rejects.toMatchObject({ code: '42501' });
  });

  it('o próprio dono também não consegue: o gatilho bloqueia UPDATE, DELETE e TRUNCATE', async () => {
    await expect(dono.query("update evento_auditoria set acao = 'x'")).rejects.toThrow(/imutável/);
    await expect(dono.query('delete from evento_auditoria')).rejects.toThrow(/imutável/);
    await expect(dono.query('truncate evento_auditoria')).rejects.toThrow(/imutável/);
    expect((await eventosDe('teste.imutavel')).length).toBe(1);
  });

  it('o papel de runtime continua podendo alterar as outras tabelas (o sistema funciona)', async () => {
    const r = await runtime.query("update usuario set nome = 'Fulana' where id = $1", [comum.id]);
    expect(r.rowCount).toBe(1);
  });
});

describe('registrar', () => {
  it('grava request_id, ip e ator do contexto da requisição', async () => {
    const requestId = `req-${randomUUID()}`;
    const email = `novo-${randomUUID().slice(0, 8)}@exemplo.com.br`;
    await request(app.getHttpServer())
      .post('/api/usuarios')
      .set('Origin', PAINEL)
      .set('x-request-id', requestId)
      .set('x-usuario-teste', cab(admin))
      .send({ email, nome: 'Pessoa Convidada', papel: 'GESTOR' })
      .expect(201);
    const [e] = (await dono.query('select * from evento_auditoria where request_id = $1', [requestId])).rows;
    expect(e).toMatchObject({ acao: 'usuario.convidar', ator_id: admin.id, alvo_tipo: 'usuario', antes: null });
    expect(e.ip).toBeTruthy();
    // dado pessoal mascarado: e-mail só com a 1ª letra e o domínio, nome nunca
    expect(e.depois).toEqual({ email: 'n***@exemplo.com.br', papel: 'GESTOR', ativo: true });
    expect(JSON.stringify(e)).not.toContain('Pessoa Convidada');
  });

  it('o request_id é o mesmo devolvido no cabeçalho da resposta quando o cliente não manda um', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/usuarios')
      .set('Origin', PAINEL)
      .set('x-usuario-teste', cab(admin))
      .send({ email: `outro-${randomUUID().slice(0, 8)}@exemplo.com.br`, nome: 'Outra', papel: 'USUARIO' })
      .expect(201);
    const id = res.headers['x-request-id'] as string;
    expect(id).toBeTruthy();
    expect((await dono.query('select 1 from evento_auditoria where request_id = $1', [id])).rowCount).toBe(1);
  });

  it('fora de uma requisição (tarefa, script) request_id e ip ficam nulos', async () => {
    await auditoria.registrar({ acao: 'sistema.tarefa', atorId: null });
    const [e] = await eventosDe('sistema.tarefa');
    expect(e).toMatchObject({ request_id: null, ip: null, ator_id: null });
  });

  it('nunca grava código, token, cookie ou segredo nos detalhes', async () => {
    await auditoria.registrar({
      acao: 'teste.segredos',
      atorId: admin.id,
      antes: { papel: 'USUARIO', token: 'tok-secreto-123' },
      depois: { codigo: '987654', cookie: '__Host-sessao=abc', aninhado: { senha: 'hunter2' }, ok: true },
    });
    const [e] = await eventosDe('teste.segredos');
    const texto = JSON.stringify(e);
    for (const proibido of ['tok-secreto-123', '987654', '__Host-sessao=abc', 'hunter2']) expect(texto).not.toContain(proibido);
    expect(e!['depois']).toMatchObject({ codigo: '[REDACTED]', ok: true });
  });

  it('nome de ação fora do formato grupo.acao é recusado (erro de programação, não vira lixo na trilha)', async () => {
    await expect(auditoria.registrar({ acao: 'Alterou Usuario' })).rejects.toThrow(/ação/i);
    await expect(auditoria.registrar({ acao: 'semponto' })).rejects.toThrow(/ação/i);
  });

  it('na mesma transação da mudança: se a mudança desfaz, o evento também some', async () => {
    const antes = await total('teste.transacao');
    await expect(
      db.transaction(async (tx) => {
        await auditoria.registrar({ acao: 'teste.transacao' }, tx);
        throw new Error('desfaz');
      }),
    ).rejects.toThrow('desfaz');
    expect(await total('teste.transacao')).toBe(antes);
    await db.transaction((tx) => auditoria.registrar({ acao: 'teste.transacao' }, tx));
    expect(await total('teste.transacao')).toBe(antes + 1);
  });
});

describe('ações de administração de usuários ficam na trilha com antes e depois', () => {
  it('alterar papel, desativar e reativar', async () => {
    const alvo = await criarUsuario(`alvo-${randomUUID().slice(0, 8)}@exemplo.com.br`, 'USUARIO');
    const h = { 'x-usuario-teste': cab(admin), Origin: PAINEL };
    await request(app.getHttpServer()).patch(`/api/usuarios/${alvo.id}/papel`).set(h).send({ papel: 'GESTOR' }).expect(200);
    await request(app.getHttpServer()).post(`/api/usuarios/${alvo.id}/desativar`).set(h).expect(200);
    await request(app.getHttpServer()).post(`/api/usuarios/${alvo.id}/reativar`).set(h).expect(200);
    const r = (await dono.query('select acao, ator_id, alvo_id, antes, depois from evento_auditoria where alvo_id = $1 order by id', [alvo.id])).rows as Record<string, unknown>[];
    expect(r.map((l) => l['acao'])).toEqual(['usuario.alterar_papel', 'usuario.desativar', 'usuario.reativar']);
    expect(r.every((l) => l['ator_id'] === admin.id)).toBe(true);
    expect(r[0]).toMatchObject({ antes: { papel: 'USUARIO', ativo: true }, depois: { papel: 'GESTOR', ativo: true } });
    expect(r[1]).toMatchObject({ antes: { papel: 'GESTOR', ativo: true }, depois: { papel: 'GESTOR', ativo: false } });
    expect(r[2]).toMatchObject({ antes: { ativo: false }, depois: { ativo: true } });
  });

  it('ação recusada (e-mail repetido, último admin) não deixa evento', async () => {
    const h = { 'x-usuario-teste': cab(admin), Origin: PAINEL };
    const antes = await total('usuario.convidar');
    await request(app.getHttpServer()).post('/api/usuarios').set(h).send({ email: admin.email, nome: 'Dup', papel: 'USUARIO' }).expect(409);
    expect(await total('usuario.convidar')).toBe(antes);
    const desativar = await total('usuario.desativar');
    await request(app.getHttpServer()).post(`/api/usuarios/${admin.id}/desativar`).set(h).expect(409);
    expect(await total('usuario.desativar')).toBe(desativar);
  });
});

describe('o administrador inicial também fica na trilha', () => {
  it('cria o ADMIN, grava usuario.admin_inicial sem ator (e-mail mascarado) e não repete ao reiniciar', async () => {
    const banco = await subirPostgres();
    const sonda = new Pool({ connectionString: banco.url, max: 1 });
    const config = carregarConfig({
      DATABASE_URL: banco.url,
      DATABASE_URL_RUNTIME: banco.urlRuntime,
      NODE_ENV: 'test',
      LOG_LEVEL: 'silent',
      ADMIN_INICIAL_EMAIL: 'primeira@exemplo.com.br',
    });
    try {
      for (let i = 0; i < 2; i++) {
        const a = await criarApp(config);
        await a.init();
        await a.close();
      }
      const eventos = (await sonda.query("select * from evento_auditoria where acao = 'usuario.admin_inicial'")).rows as Record<string, unknown>[];
      expect(eventos).toHaveLength(1);
      const [u] = (await sonda.query("select id from usuario where email = 'primeira@exemplo.com.br'")).rows as { id: string }[];
      expect(eventos[0]).toMatchObject({ ator_id: null, alvo_tipo: 'usuario', alvo_id: u!.id, antes: null, depois: { email: 'p***@exemplo.com.br', papel: 'ADMIN', ativo: true } });
    } finally {
      await sonda.end();
      await banco.parar();
    }
  });
});

describe('eventos do login chegam na trilha (REGISTRO_EVENTOS)', () => {
  it('falha, login e logout, sem código nem token no banco', async () => {
    const email = `login-${randomUUID().slice(0, 8)}@exemplo.com.br`;
    const pessoa = await criarUsuario(email, 'USUARIO');
    const api = () => request(app.getHttpServer());
    await api().post('/api/auth/codigo').set('Origin', PAINEL).send({ email }).expect(202);
    const codigo = /\b(\d{6})\b/.exec(enviados.at(-1)!.texto)![1]!;
    const errado = codigo === '000000' ? '111111' : '000000';
    await api().post('/api/auth/entrar').set('Origin', PAINEL).send({ email, codigo: errado }).expect(401);
    const res = await api().post('/api/auth/entrar').set('Origin', PAINEL).send({ email, codigo }).expect(204);
    const cookie = ([] as string[]).concat(res.headers['set-cookie'] ?? [])[0]!.split(';')[0]!;
    await api().post('/api/auth/sair').set('Origin', PAINEL).set('Cookie', cookie).expect(204);

    const falha = (await eventosDe('auth.falha_login')).find((e) => (e['depois'] as { email?: string }).email === 'l***@exemplo.com.br');
    expect(falha).toBeTruthy();
    const [login] = (await dono.query("select * from evento_auditoria where acao = 'auth.login' and ator_id = $1", [pessoa.id])).rows;
    expect(login).toMatchObject({ alvo_tipo: 'usuario', alvo_id: pessoa.id });
    const [logout] = (await dono.query("select * from evento_auditoria where acao = 'auth.logout' and ator_id = $1", [pessoa.id])).rows;
    expect(logout).toBeTruthy();
    expect(login.request_id).toBeTruthy();

    const tudo = JSON.stringify((await dono.query('select * from evento_auditoria')).rows);
    expect(tudo).not.toContain(codigo);
    expect(tudo).not.toContain(cookie.split('=')[1]!);
    expect(tudo).not.toContain(email);
  });
});

const alvos = (res: Response): string[] => (res.body as { itens: { alvoId: string }[] }).itens.map((e) => e.alvoId);

describe('GET /api/admin/auditoria', () => {
  const ATOR_A = randomUUID();
  const ATOR_B = randomUUID();

  beforeAll(async () => {
    await semear([
      { atorId: ATOR_A, acao: 'filtro.criar', quando: '2026-03-01T12:00:00-03:00', alvoId: 'a1' },
      { atorId: ATOR_A, acao: 'filtro.apagar', quando: '2026-03-02T12:00:00-03:00', alvoId: 'a2' },
      { atorId: ATOR_B, acao: 'filtro.criar', quando: '2026-03-03T12:00:00-03:00', alvoId: 'b1' },
      { atorId: ATOR_B, acao: 'filtro.criar', quando: '2026-03-04T12:00:00-03:00', alvoId: 'b2' },
      { atorId: ATOR_B, acao: 'filtro.criar', quando: '2026-03-05T12:00:00-03:00', alvoId: '=1+1' },
    ]);
  });

  const listar = (consulta: Record<string, string>, como: Linha | null = admin) => {
    const r = request(app.getHttpServer()).get('/api/admin/auditoria').query(consulta);
    return como ? r.set('x-usuario-teste', cab(como)) : r;
  };

  it('sem sessão: 401; USUARIO e GESTOR: 403; ADMIN: 200', async () => {
    await listar({}, null).expect(401);
    await listar({}, comum).expect(403);
    await listar({}, gestor).expect(403);
    const res = await listar({}).expect(200);
    expect(res.body.itens.length).toBeGreaterThan(0);
  });

  it('o serviço também recusa quem não é ADMIN (defesa em profundidade)', async () => {
    await expect(app.get(AuditoriaService).listar({ id: comum.id, email: comum.email, nome: comum.nome, papel: 'USUARIO' }, { limite: 10 })).rejects.toMatchObject({ status: 403 });
  });

  it('filtra por ator', async () => {
    const res = await listar({ atorId: ATOR_A }).expect(200);
    expect(alvos(res).sort()).toEqual(['a1', 'a2']);
  });

  it('filtra por ação', async () => {
    const res = await listar({ atorId: ATOR_A, acao: 'filtro.apagar' }).expect(200);
    expect(alvos(res)).toEqual(['a2']);
  });

  it('filtra por período (de e ate inclusivos, com fuso)', async () => {
    const res = await listar({ atorId: ATOR_B, de: '2026-03-04T00:00:00-03:00', ate: '2026-03-04T23:59:59.999-03:00' }).expect(200);
    expect(alvos(res)).toEqual(['b2']);
  });

  it('combina os filtros e devolve o mais novo primeiro', async () => {
    const res = await listar({ acao: 'filtro.criar', de: '2026-03-01T00:00:00-03:00', ate: '2026-03-31T23:59:59-03:00' }).expect(200);
    expect(alvos(res)).toEqual(['=1+1', 'b2', 'b1', 'a1']);
  });

  it('pagina por cursor sem repetir nem pular', async () => {
    const p1 = await listar({ acao: 'filtro.criar', limite: '3' }).expect(200);
    expect(p1.body.itens).toHaveLength(3);
    expect(p1.body.proximoCursor).toBeTruthy();
    const p2 = await listar({ acao: 'filtro.criar', limite: '3', cursor: p1.body.proximoCursor }).expect(200);
    expect(p2.body.itens).toHaveLength(1);
    expect(p2.body.proximoCursor).toBeNull();
    const ids = [...p1.body.itens, ...p2.body.itens].map((e: { id: string }) => e.id);
    expect(new Set(ids).size).toBe(4);
  });

  it('traz o e-mail do ator quando ele é um usuário', async () => {
    const res = await listar({ acao: 'usuario.convidar' }).expect(200);
    expect(res.body.itens[0]).toMatchObject({ atorId: admin.id, atorEmail: admin.email });
  });

  it('parâmetros inválidos → 400 em JSON padrão', async () => {
    for (const q of [{ limite: '999' }, { atorId: 'ana' }, { de: 'ontem' }, { acao: 'Dropar Tabela' }, { cursor: 'x' }] as Record<string, string>[]) {
      const res = await listar(q).expect(400);
      expect(res.body).toMatchObject({ status: 400 });
    }
  });

  it('não há rotas para alterar ou apagar eventos', async () => {
    const h = { 'x-usuario-teste': cab(admin), Origin: PAINEL };
    await request(app.getHttpServer()).delete('/api/admin/auditoria/1').set(h).expect(404);
    await request(app.getHttpServer()).patch('/api/admin/auditoria/1').set(h).send({}).expect(404);
    await request(app.getHttpServer()).post('/api/admin/auditoria').set(h).send({ acao: 'a.b' }).expect(404);
  });
});

describe('GET /api/admin/auditoria/csv', () => {
  const csv = (consulta: Record<string, string>, como: Linha = admin) =>
    request(app.getHttpServer()).get('/api/admin/auditoria/csv').query(consulta).set('x-usuario-teste', cab(como));

  it('só ADMIN', async () => {
    await request(app.getHttpServer()).get('/api/admin/auditoria/csv').expect(401);
    await csv({}, comum).expect(403);
    await csv({}, gestor).expect(403);
  });

  it('CSV com BOM UTF-8, separador ponto e vírgula, cabeçalho em português e as linhas do filtro', async () => {
    const res = await csv({ acao: 'filtro.criar' }).expect(200);
    expect(res.headers['content-type']).toMatch(/^text\/csv; charset=utf-8/);
    expect(res.headers['content-disposition']).toMatch(/^attachment; filename="auditoria-\d{8}\.csv"; filename\*=UTF-8''auditoria-\d{8}\.csv$/);
    expect(res.text.charCodeAt(0)).toBe(0xfeff);
    const linhas = res.text.slice(1).split('\r\n').filter(Boolean);
    expect(linhas[0]).toBe('Id;Data e hora (Brasília);Ator;Ator (id);Ação;Alvo (tipo);Alvo (id);Antes;Depois;IP;Request-id');
    expect(linhas).toHaveLength(1 + 4);
    expect(linhas[1]!.split(';')[4]).toBe('filtro.criar');
  });

  it('célula que começa com = vira texto (não executa como fórmula na planilha)', async () => {
    const res = await csv({ acao: 'filtro.criar' }).expect(200);
    expect(res.text).toContain(";'=1+1;");
    expect(res.text).not.toContain(';=1+1;');
  });

  it('a própria exportação fica na trilha, com o filtro e a quantidade de linhas', async () => {
    const antes = await total('auditoria.exportar');
    await csv({ acao: 'filtro.apagar' }).expect(200);
    const eventos = await eventosDe('auditoria.exportar');
    expect(eventos.length).toBe(antes + 1);
    expect(eventos[0]).toMatchObject({ ator_id: admin.id, depois: { filtros: { acao: 'filtro.apagar' }, linhas: 1 } });
  });

  it('filtro inválido → 400', async () => {
    await csv({ atorId: 'x' }).expect(400);
  });
});

describe('tabela só cresce', () => {
  it('ids sempre crescentes e nenhum evento some depois de tudo isso', async () => {
    const r = await db.select({ id: eventoAuditoria.id }).from(eventoAuditoria).orderBy(desc(eventoAuditoria.id)).limit(1);
    expect(r[0]!.id).toBeGreaterThan(10);
    expect((await dono.query("select 1 from evento_auditoria where acao = 'teste.imutavel'")).rowCount).toBe(1);
  });
});
