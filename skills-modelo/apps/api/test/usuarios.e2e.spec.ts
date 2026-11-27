import { randomUUID } from 'node:crypto';
import { type INestApplication } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, type MockInstance, vi } from 'vitest';
import { BANCO, type Db } from '../src/banco/banco';
import { usuario } from '../src/banco/esquema';
import { carregarConfig } from '../src/config/config';
import { criarApp } from '../src/criar-app';
import { EmailModule } from '../src/email/email.module';
import { ServicoEmail } from '../src/email/servico-email';
import { UsuariosModule } from '../src/usuarios/usuarios.module';
import { UsuariosService } from '../src/usuarios/usuarios.service';
import { subirPostgres } from './postgres';
import { comoUsuario, exporUsuarioDeTeste } from './usuario-de-teste';

const PAINEL = 'https://painel.exemplo.com.br';
const MALICIOSO = 'https://malicioso.exemplo';

let urlBanco: string;
let parar: () => Promise<void>;
const apps: INestApplication[] = [];

type Linha = typeof usuario.$inferSelect;

async function subirApi(extra: Record<string, string> = {}, banco = urlBanco): Promise<INestApplication> {
  const config = carregarConfig({ DATABASE_URL: banco, NODE_ENV: 'test', LOG_LEVEL: 'silent', CORS_ORIGENS: PAINEL, ...extra });
  const app = await criarApp(config);
  exporUsuarioDeTeste(app);
  await app.init();
  apps.push(app);
  return app;
}

const dbDe = (app: INestApplication) => app.get<Db>(BANCO);

async function criarUsuario(
  app: INestApplication,
  dados: { email: string; papel: 'ADMIN' | 'GESTOR' | 'USUARIO'; ativo?: boolean; nome?: string },
): Promise<Linha> {
  const [linha] = await dbDe(app)
    .insert(usuario)
    .values({ email: dados.email, nome: dados.nome ?? 'Fulano', papel: dados.papel, ativo: dados.ativo ?? true })
    .returning();
  return linha!;
}

const cab = (u: { id: string; email: string; nome: string; papel: string }) => comoUsuario(u);

beforeAll(async () => {
  ({ url: urlBanco, parar } = await subirPostgres());
});

afterAll(async () => {
  for (const app of apps) await app.close().catch(() => undefined);
  await parar?.();
});

describe('guard por papel nas rotas de administração', () => {
  let app: INestApplication;
  let admin: Linha;
  let comum: Linha;
  let gestor: Linha;

  beforeAll(async () => {
    app = await subirApi();
    admin = await criarUsuario(app, { email: 'admin@exemplo.com.br', papel: 'ADMIN' });
    gestor = await criarUsuario(app, { email: 'gestor@exemplo.com.br', papel: 'GESTOR' });
    comum = await criarUsuario(app, { email: 'comum@exemplo.com.br', papel: 'USUARIO' });
  });

  it('sem usuário na requisição → 401', async () => {
    await request(app.getHttpServer()).get('/api/usuarios').expect(401);
  });

  it('USUARIO em rota @Papeis("ADMIN") → 403', async () => {
    const res = await request(app.getHttpServer()).get('/api/usuarios').set('x-usuario-teste', cab(comum)).expect(403);
    expect(res.body).toMatchObject({ status: 403 });
  });

  it('GESTOR também → 403 (a rota é só de ADMIN)', async () => {
    await request(app.getHttpServer()).get('/api/usuarios').set('x-usuario-teste', cab(gestor)).expect(403);
  });

  it('papel "admin" minúsculo na sessão não vale → 403', async () => {
    await request(app.getHttpServer()).get('/api/usuarios').set('x-usuario-teste', cab({ ...admin, papel: 'admin' })).expect(403);
  });

  it('ADMIN lista os usuários, com ativos e desativados, sem campos internos', async () => {
    const res = await request(app.getHttpServer()).get('/api/usuarios').set('x-usuario-teste', cab(admin)).expect(200);
    const emails = (res.body as { email: string }[]).map((u) => u.email);
    expect(emails).toEqual(expect.arrayContaining(['admin@exemplo.com.br', 'comum@exemplo.com.br']));
    expect(Object.keys((res.body as object[])[0]!).sort()).toEqual(['ativo', 'criadoEm', 'email', 'id', 'nome', 'papel']);
  });

  it('rotas que mudam dados recusam Origin de outro site (guarda de origem da skill seguranca)', async () => {
    await request(app.getHttpServer())
      .post('/api/usuarios')
      .set('x-usuario-teste', cab(admin))
      .set('Origin', MALICIOSO)
      .send({ email: 'forjado@exemplo.com.br', nome: 'Forjado', papel: 'ADMIN' })
      .expect(403);
    const linhas = await dbDe(app).select().from(usuario).where(eq(usuario.email, 'forjado@exemplo.com.br'));
    expect(linhas).toHaveLength(0);
  });
});

describe('convidar', () => {
  let app: INestApplication;
  let admin: Linha;
  let disparar: MockInstance<ServicoEmail['disparar']>;

  beforeAll(async () => {
    app = await subirApi({ NOME_SISTEMA: 'Crédito <Multiplica>' });
    admin = await criarUsuario(app, { email: 'admin-convite@exemplo.com.br', papel: 'ADMIN' });
    disparar = vi.spyOn(app.select(EmailModule).get(ServicoEmail), 'disparar');
  });

  const convidar = (corpo: unknown, origem = PAINEL) =>
    request(app.getHttpServer())
      .post('/api/usuarios')
      .set('x-usuario-teste', cab(admin))
      .set('Origin', origem)
      .send(corpo as object);

  it('cria o usuário ativo, com e-mail minúsculo e sem espaços, e avisa por e-mail', async () => {
    const res = await convidar({ email: '  Beatriz.Souza@Exemplo.com.BR ', nome: 'Beatriz <b>Souza</b>', papel: 'GESTOR' }).expect(201);
    expect(res.body).toMatchObject({ email: 'beatriz.souza@exemplo.com.br', papel: 'GESTOR', ativo: true });
    const [linha] = await dbDe(app).select().from(usuario).where(eq(usuario.email, 'beatriz.souza@exemplo.com.br'));
    expect(linha?.ativo).toBe(true);

    expect(disparar).toHaveBeenCalledTimes(1);
    const msg = disparar.mock.calls[0]![0];
    expect(msg.para).toBe('beatriz.souza@exemplo.com.br');
    expect(msg.assunto).toBe('Você foi adicionado ao sistema');
    expect(msg.assunto).not.toContain('Beatriz');
    // nome do usuário e nome do sistema entram escapados no HTML
    expect(msg.html).not.toContain('<b>Souza</b>');
    expect(msg.html).toContain('Beatriz &lt;b&gt;Souza&lt;/b&gt;');
    expect(msg.html).toContain('Crédito &lt;Multiplica&gt;');
    expect(msg.texto).toContain('entre com seu e-mail');
  });

  it('e-mail repetido em outra caixa → 409 e nenhum e-mail enviado', async () => {
    disparar.mockClear();
    await convidar({ email: 'BEATRIZ.SOUZA@exemplo.com.br', nome: 'Outra', papel: 'USUARIO' }).expect(409);
    expect(disparar).not.toHaveBeenCalled();
  });

  it('o banco recusa dois e-mails que só diferem na caixa (índice único em lower(email))', async () => {
    await expect(criarUsuario(app, { email: 'Beatriz.Souza@exemplo.com.br', papel: 'USUARIO' })).rejects.toThrow();
  });

  it.each([
    [{ email: 'sem-arroba', nome: 'X', papel: 'USUARIO' }],
    [{ email: 'x@exemplo.com.br', nome: '   ', papel: 'USUARIO' }],
    [{ email: 'x@exemplo.com.br', nome: 'X', papel: 'admin' }],
    [{ email: 'x@exemplo.com.br', nome: 'X', papel: 'SUPER' }],
    [{ email: 'x@exemplo.com.br', nome: 'X' }],
  ])('corpo inválido %j → 400', async (corpo) => {
    await convidar(corpo).expect(400);
  });
});

describe('desativar e reativar (nunca apagar)', () => {
  let app: INestApplication;
  let admin: Linha;

  beforeAll(async () => {
    app = await subirApi();
    admin = await criarUsuario(app, { email: 'admin-des@exemplo.com.br', papel: 'ADMIN' });
  });

  const acao = (id: string, caminho: string) =>
    request(app.getHttpServer()).post(`/api/usuarios/${id}/${caminho}`).set('x-usuario-teste', cab(admin)).set('Origin', PAINEL).send({});

  it('desativar mantém a linha, com ativo=false; reativar volta a true', async () => {
    const alvo = await criarUsuario(app, { email: 'alvo@exemplo.com.br', papel: 'USUARIO' });
    await acao(alvo.id, 'desativar').expect(200);
    const [depois] = await dbDe(app).select().from(usuario).where(eq(usuario.id, alvo.id));
    expect(depois).toBeDefined();
    expect(depois?.ativo).toBe(false);

    await acao(alvo.id, 'reativar').expect(200);
    const [reativado] = await dbDe(app).select().from(usuario).where(eq(usuario.id, alvo.id));
    expect(reativado?.ativo).toBe(true);
  });

  it('não existe rota para apagar usuário', async () => {
    const alvo = await criarUsuario(app, { email: 'permanece@exemplo.com.br', papel: 'USUARIO' });
    const res = await request(app.getHttpServer()).delete(`/api/usuarios/${alvo.id}`).set('x-usuario-teste', cab(admin)).set('Origin', PAINEL);
    expect(res.status).toBe(404);
    expect(await dbDe(app).select().from(usuario).where(eq(usuario.id, alvo.id))).toHaveLength(1);
  });

  it('id inexistente → 404 e id que não é UUID → 400', async () => {
    await acao(randomUUID(), 'desativar').expect(404);
    await acao('nao-e-uuid', 'desativar').expect(400);
  });
});

describe('último ADMIN', () => {
  let app: INestApplication;
  let pararBancoProprio: () => Promise<void>;

  // Banco só deste grupo: os outros grupos criam ADMIN e mudariam a contagem de administradores ativos.
  beforeAll(async () => {
    const pg = await subirPostgres();
    pararBancoProprio = pg.parar;
    app = await subirApi({}, pg.url);
  });

  afterAll(async () => {
    await app.close().catch(() => undefined);
    await pararBancoProprio?.();
  });

  const como = (u: { id: string; email: string; nome: string; papel: string }) => (m: 'post' | 'patch', caminho: string, corpo: object = {}) =>
    request(app.getHttpServer())[m](`/api/usuarios/${caminho}`).set('x-usuario-teste', cab(u)).set('Origin', PAINEL).send(corpo);

  it('não dá para desativar o último ADMIN ativo → 409; ele continua ativo', async () => {
    const unico = await criarUsuario(app, { email: 'unico@exemplo.com.br', papel: 'ADMIN' });
    // outro ADMIN já desativado não conta como ativo
    await criarUsuario(app, { email: 'ex-admin@exemplo.com.br', papel: 'ADMIN', ativo: false });
    const res = await como(unico)('post', `${unico.id}/desativar`).expect(409);
    expect(res.body).toMatchObject({ status: 409 });
    const [linha] = await dbDe(app).select().from(usuario).where(eq(usuario.id, unico.id));
    expect(linha?.ativo).toBe(true);
  });

  it('não dá para rebaixar o último ADMIN → 409; o papel não muda', async () => {
    const [unico] = await dbDe(app).select().from(usuario).where(eq(usuario.email, 'unico@exemplo.com.br'));
    await como(unico!)('patch', `${unico!.id}/papel`, { papel: 'GESTOR' }).expect(409);
    const [linha] = await dbDe(app).select().from(usuario).where(eq(usuario.id, unico!.id));
    expect(linha?.papel).toBe('ADMIN');
  });

  it('com dois ADMIN ativos dá para rebaixar um; o outro vira o último', async () => {
    const [a] = await dbDe(app).select().from(usuario).where(eq(usuario.email, 'unico@exemplo.com.br'));
    const b = await criarUsuario(app, { email: 'segundo@exemplo.com.br', papel: 'ADMIN' });
    await como(a!)('patch', `${b.id}/papel`, { papel: 'USUARIO' }).expect(200);
    await como(a!)('post', `${a!.id}/desativar`).expect(409);
  });

  it('dois ADMIN se desativando ao mesmo tempo: um passa e o outro leva 409 (nunca zero ADMIN)', async () => {
    const x = await criarUsuario(app, { email: 'corrida-x@exemplo.com.br', papel: 'ADMIN' });
    const y = await criarUsuario(app, { email: 'corrida-y@exemplo.com.br', papel: 'ADMIN' });
    // desativa os demais ADMIN para sobrarem só x e y
    await dbDe(app).execute(sql`update usuario set ativo = false where papel = 'ADMIN' and id not in (${x.id}, ${y.id})`);
    const [r1, r2] = await Promise.all([como(x)('post', `${y.id}/desativar`), como(y)('post', `${x.id}/desativar`)]);
    expect([r1.status, r2.status].sort()).toEqual([200, 409]);
    const ativos = await dbDe(app).execute(sql`select count(*)::int as n from usuario where papel = 'ADMIN' and ativo`);
    expect((ativos.rows[0] as { n: number }).n).toBe(1);
  });
});

describe('trocar papel', () => {
  it('ADMIN troca o papel; papel inválido (inclusive minúsculo) → 400', async () => {
    const app = await subirApi();
    const admin = await criarUsuario(app, { email: 'admin-papel@exemplo.com.br', papel: 'ADMIN' });
    const alvo = await criarUsuario(app, { email: 'alvo-papel@exemplo.com.br', papel: 'USUARIO' });
    const patch = (corpo: object) =>
      request(app.getHttpServer()).patch(`/api/usuarios/${alvo.id}/papel`).set('x-usuario-teste', cab(admin)).set('Origin', PAINEL).send(corpo);
    await patch({ papel: 'GESTOR' }).expect(200);
    expect((await dbDe(app).select().from(usuario).where(eq(usuario.id, alvo.id)))[0]?.papel).toBe('GESTOR');
    await patch({ papel: 'gestor' }).expect(400);
    await patch({}).expect(400);
  });
});

describe('escopo no serviço (não só no decorator)', () => {
  let app: INestApplication;
  let servico: UsuariosService;
  let admin: Linha;
  let ana: Linha;
  let beto: Linha;

  beforeAll(async () => {
    app = await subirApi();
    servico = app.select(UsuariosModule).get(UsuariosService);
    admin = await criarUsuario(app, { email: 'admin-escopo@exemplo.com.br', papel: 'ADMIN' });
    ana = await criarUsuario(app, { email: 'ana@exemplo.com.br', papel: 'USUARIO', nome: 'Ana' });
    beto = await criarUsuario(app, { email: 'beto@exemplo.com.br', papel: 'USUARIO', nome: 'Beto' });
  });

  it('USUARIO lê o próprio perfil e não o de outro (403)', async () => {
    const proprio = await request(app.getHttpServer()).get(`/api/usuarios/${ana.id}`).set('x-usuario-teste', cab(ana)).expect(200);
    expect(proprio.body).toMatchObject({ email: 'ana@exemplo.com.br' });
    await request(app.getHttpServer()).get(`/api/usuarios/${beto.id}`).set('x-usuario-teste', cab(ana)).expect(403);
  });

  it('ADMIN lê o perfil de qualquer um', async () => {
    await request(app.getHttpServer()).get(`/api/usuarios/${beto.id}`).set('x-usuario-teste', cab(admin)).expect(200);
  });

  it('GET /usuarios/eu devolve o usuário da sessão', async () => {
    const res = await request(app.getHttpServer()).get('/api/usuarios/eu').set('x-usuario-teste', cab(ana)).expect(200);
    expect(res.body).toMatchObject({ id: ana.id, papel: 'USUARIO' });
  });

  it('chamar o serviço direto, sem passar pelo guard, também nega a quem não é ADMIN', async () => {
    const ator = { id: ana.id, email: ana.email, nome: ana.nome, papel: 'USUARIO' as const };
    await expect(servico.desativar(ator, beto.id)).rejects.toMatchObject({ status: 403 });
    await expect(servico.alterarPapel(ator, beto.id, 'ADMIN')).rejects.toMatchObject({ status: 403 });
    await expect(servico.convidar(ator, { email: 'x@exemplo.com.br', nome: 'X', papel: 'USUARIO' })).rejects.toMatchObject({ status: 403 });
    await expect(servico.perfil(ator, beto.id)).rejects.toMatchObject({ status: 403 });
    expect((await dbDe(app).select().from(usuario).where(eq(usuario.id, beto.id)))[0]?.ativo).toBe(true);
  });
});

describe('primeiro admin (ADMIN_INICIAL_EMAIL)', () => {
  it('cria o admin inicial uma vez só, mesmo reiniciando várias vezes', async () => {
    const pg = await subirPostgres();
    try {
      const extra = { ADMIN_INICIAL_EMAIL: '  Primeira.Admin@Exemplo.com.BR ' };
      for (let i = 0; i < 3; i++) {
        const app = await subirApi(extra, pg.url);
        await app.close();
      }
      const app = await subirApi(extra, pg.url);
      const linhas = await dbDe(app).select().from(usuario);
      expect(linhas).toHaveLength(1);
      expect(linhas[0]).toMatchObject({ email: 'primeira.admin@exemplo.com.br', papel: 'ADMIN', ativo: true });
    } finally {
      await pg.parar();
    }
  });

  it('não cria nada se já existe um ADMIN ativo', async () => {
    const pg = await subirPostgres();
    try {
      const app1 = await subirApi({}, pg.url);
      await criarUsuario(app1, { email: 'ja-existe@exemplo.com.br', papel: 'ADMIN' });
      await app1.close();
      const app2 = await subirApi({ ADMIN_INICIAL_EMAIL: 'outro@exemplo.com.br' }, pg.url);
      const emails = (await dbDe(app2).select().from(usuario)).map((u) => u.email);
      expect(emails).toEqual(['ja-existe@exemplo.com.br']);
    } finally {
      await pg.parar();
    }
  });

  it('sem ADMIN_INICIAL_EMAIL não cria ninguém', async () => {
    const pg = await subirPostgres();
    try {
      const app = await subirApi({}, pg.url);
      expect(await dbDe(app).select().from(usuario)).toHaveLength(0);
    } finally {
      await pg.parar();
    }
  });

  it('se o e-mail inicial existe mas está desativado e não há ADMIN ativo, reativa como ADMIN', async () => {
    const pg = await subirPostgres();
    try {
      const app1 = await subirApi({}, pg.url);
      await criarUsuario(app1, { email: 'volta@exemplo.com.br', papel: 'USUARIO', ativo: false });
      await app1.close();
      const app2 = await subirApi({ ADMIN_INICIAL_EMAIL: 'volta@exemplo.com.br' }, pg.url);
      const linhas = await dbDe(app2).select().from(usuario);
      expect(linhas).toHaveLength(1);
      expect(linhas[0]).toMatchObject({ papel: 'ADMIN', ativo: true });
    } finally {
      await pg.parar();
    }
  });
});
