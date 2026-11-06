import { mkdtemp, readdir, rm } from 'node:fs/promises';
import http from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { type INestApplication } from '@nestjs/common';
import ExcelJS from 'exceljs';
import { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { BANCO, type Db } from '../src/banco/banco';
import { usuario } from '../src/banco/esquema';
import { type Config, carregarConfig } from '../src/config/config';
import { criarApp } from '../src/criar-app';
import { type ClamdFalso, EICAR_TESTE, subirClamdFalso } from './clamd-falso';
import { subirPostgres } from './postgres';
import { comoUsuario, exporUsuarioDeTeste } from './usuario-de-teste';

const PAINEL = 'https://painel.exemplo.com.br';
const SEGREDO_URL = 'segredo-das-urls-assinadas-de-teste-0123456789';
const PDF = Buffer.concat([Buffer.from('%PDF-1.7\n% conteudo de teste\n'), Buffer.alloc(2000, 0x20)]);
const MZ = Buffer.concat([Buffer.from('MZ\x90\x00\x03\x00\x00\x00'), Buffer.alloc(500)]);

let parar: () => Promise<void>;
let dono: Pool;
let pasta: string;
let pastaAv: string;
let app: INestApplication;
let appAv: INestApplication;
let clamd: ClamdFalso;
let db: Db;

type Linha = typeof usuario.$inferSelect;
let admin: Linha;
let gestor: Linha;
let ana: Linha;
let beto: Linha;
let limitado: Linha;

const base = (u: Linha, a: INestApplication = app) => ({
  post: (p: string) => request(a.getHttpServer()).post(p).set('x-usuario-teste', comoUsuario(u)).set('Origin', PAINEL),
  get: (p: string) => request(a.getHttpServer()).get(p).set('x-usuario-teste', comoUsuario(u)),
  delete: (p: string) => request(a.getHttpServer()).delete(p).set('x-usuario-teste', comoUsuario(u)).set('Origin', PAINEL),
});

async function criarUsuario(email: string, papel: 'ADMIN' | 'GESTOR' | 'USUARIO'): Promise<Linha> {
  const [linha] = await db.insert(usuario).values({ email, nome: 'Fulana', papel, ativo: true }).returning();
  return linha!;
}

const enviar = (u: Linha, conteudo: Buffer, nome = 'relatorio.pdf', tipo = 'application/pdf', escopo?: string, a: INestApplication = app) => {
  let r = base(u, a).post('/api/arquivos');
  if (escopo) r = r.field('escopo', escopo);
  return r.attach('arquivo', conteudo, { filename: nome, contentType: tipo });
};

const baixar = (u: Linha, id: string) =>
  base(u)
    .get(`/api/arquivos/${id}/download`)
    .buffer(true)
    .parse((res, cb) => {
      const partes: Buffer[] = [];
      res.on('data', (p: Buffer) => partes.push(p));
      res.on('end', () => cb(null, Buffer.concat(partes)));
    });

interface EventoDb {
  ator_id: string | null;
  alvo_tipo: string | null;
  alvo_id: string | null;
  depois: unknown;
}
const eventosDe = async (acao: string) => (await dono.query('select * from evento_auditoria where acao = $1 order by id', [acao])).rows as EventoDb[];
const linhasDeArquivo = async () => Number((await dono.query('select count(*)::int as n from arquivo')).rows[0].n);

/** POST multipart sem Content-Length (chunked): o servidor não tem como saber o tamanho antes de ler. */
function enviarEmPartes(porta: number, u: Linha, tamanho: number): Promise<{ status: number }> {
  return new Promise((resolve, reject) => {
    const limite = 'LIMITE-TESTE';
    const req = http.request(
      {
        host: '127.0.0.1',
        port: porta,
        path: '/api/arquivos',
        method: 'POST',
        headers: { 'content-type': `multipart/form-data; boundary=${limite}`, 'x-usuario-teste': comoUsuario(u), origin: PAINEL, 'transfer-encoding': 'chunked' },
      },
      (res) => {
        res.resume();
        resolve({ status: res.statusCode ?? 0 });
      },
    );
    req.on('error', (e) => {
      // O servidor recusa e fecha a conexão com o cliente ainda escrevendo: a resposta pode se perder no reset (status 0).
      if ((e as NodeJS.ErrnoException).code === 'EPIPE' || (e as NodeJS.ErrnoException).code === 'ECONNRESET') return resolve({ status: 0 });
      reject(e);
    });
    req.write(`--${limite}\r\nContent-Disposition: form-data; name="arquivo"; filename="grande.pdf"\r\nContent-Type: application/pdf\r\n\r\n%PDF-1.7\n`);
    let enviado = 0;
    const bloco = Buffer.alloc(64 * 1024, 0x61);
    const escrever = () => {
      while (enviado < tamanho) {
        enviado += bloco.length;
        if (req.destroyed || !req.write(bloco)) {
          if (!req.destroyed) req.once('drain', escrever);
          return;
        }
      }
      req.end(`\r\n--${limite}--\r\n`);
    };
    escrever();
  });
}

beforeAll(async () => {
  let urlDono: string;
  let urlRuntime: string;
  ({ url: urlDono, urlRuntime, parar } = await subirPostgres());
  dono = new Pool({ connectionString: urlDono, max: 2 });
  pasta = await mkdtemp(path.join(tmpdir(), 'e2e-arquivos-'));
  pastaAv = await mkdtemp(path.join(tmpdir(), 'e2e-arquivos-av-'));
  clamd = await subirClamdFalso();
  const comum = {
    DATABASE_URL: urlDono,
    DATABASE_URL_RUNTIME: urlRuntime,
    NODE_ENV: 'test',
    LOG_LEVEL: 'silent',
    CORS_ORIGENS: PAINEL,
    UPLOAD_MAX_MB: '1',
    UPLOAD_LIMITE_POR_MIN: '40',
    ARMAZENAMENTO_SEGREDO_URL: SEGREDO_URL,
    LIMITE_REQ_POR_IP: '10000',
  };
  const config: Config = carregarConfig({ ...comum, ARMAZENAMENTO_PASTA: pasta });
  const configAv: Config = carregarConfig({ ...comum, ARMAZENAMENTO_PASTA: pastaAv, ANTIVIRUS_HABILITADO: 'true', CLAMAV_HOST: '127.0.0.1', CLAMAV_PORTA: String(clamd.porta) });
  app = await criarApp(config);
  exporUsuarioDeTeste(app);
  await app.init();
  appAv = await criarApp(configAv);
  exporUsuarioDeTeste(appAv);
  await appAv.init();
  db = app.get<Db>(BANCO);
  admin = await criarUsuario('admin@exemplo.com.br', 'ADMIN');
  gestor = await criarUsuario('gestor@exemplo.com.br', 'GESTOR');
  ana = await criarUsuario('ana@exemplo.com.br', 'USUARIO');
  beto = await criarUsuario('beto@exemplo.com.br', 'USUARIO');
  limitado = await criarUsuario('limitado@exemplo.com.br', 'USUARIO');
}, 180_000);

afterAll(async () => {
  await app?.close().catch(() => undefined);
  await appAv?.close().catch(() => undefined);
  await clamd?.parar();
  await dono?.end().catch(() => undefined);
  await parar?.();
  await rm(pasta, { recursive: true, force: true });
  await rm(pastaAv, { recursive: true, force: true });
});

describe('POST /api/arquivos: o que o servidor aceita', () => {
  it('sem sessão → 401; não é multipart → 415; sem arquivo → 400; escopo desconhecido → 400', async () => {
    await request(app.getHttpServer()).post('/api/arquivos').set('Origin', PAINEL).attach('arquivo', PDF, 'a.pdf').expect(401);
    await base(ana).post('/api/arquivos').send({ nome: 'x' }).expect(415);
    await base(ana).post('/api/arquivos').field('escopo', 'PRIVADO').expect(400);
    await enviar(ana, PDF, 'a.pdf', 'application/pdf', 'PUBLICO').expect(400);
    expect(await readdir(pasta)).toEqual([]);
  });

  it('PDF válido → 201 com metadados (sem a chave do servidor) e o arquivo vai para o armazenamento', async () => {
    const res = await enviar(ana, PDF, 'Relatório março.pdf').expect(201);
    expect(res.body).toMatchObject({ nome: 'Relatório março.pdf', tipo: 'application/pdf', tamanho: PDF.length, escopo: 'PRIVADO', donoId: ana.id });
    expect(res.body.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(Object.keys(res.body)).not.toContain('chave');
    expect((await readdir(pasta)).filter((f) => !f.startsWith('.'))).toHaveLength(1);
  });

  it('o nome do cliente nunca vira caminho: ../../x.pdf é gravado sob chave uuid e o nome fica só como metadado', async () => {
    const antes = new Set(await readdir(pasta));
    const res = await enviar(ana, PDF, '../../x.pdf').expect(201);
    const novos = (await readdir(pasta)).filter((f) => !antes.has(f));
    expect(novos).toHaveLength(1);
    expect(novos[0]).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.pdf$/);
    expect(res.body.nome).toBe('x.pdf');
    const [linha] = (await dono.query('select chave, nome_original from arquivo where id = $1', [res.body.id])).rows as { chave: string; nome_original: string }[];
    expect(linha!.chave).toBe(novos[0]);
    expect(linha!.nome_original).toBe('x.pdf');
  });

  it('o tipo vem do conteúdo, não do nome nem do Content-Type: PDF "chamado .exe" é um PDF .pdf', async () => {
    const res = await enviar(ana, PDF, 'virus.exe', 'application/x-msdownload').expect(201);
    expect(res.body.nome).toBe('virus.pdf');
    expect(res.body.tipo).toBe('application/pdf');
  });

  it('.exe renomeado para .pdf → 415, nada gravado', async () => {
    const antes = (await readdir(pasta)).length;
    const linhas = await linhasDeArquivo();
    const res = await enviar(ana, MZ, 'documento.pdf', 'application/pdf').expect(415);
    expect(res.body.erro).toMatch(/tipo/i);
    expect((await readdir(pasta)).length).toBe(antes);
    expect(await linhasDeArquivo()).toBe(linhas);
  });

  it('SVG e HTML (vetores de XSS armazenado) → 415 mesmo com Content-Type de imagem', async () => {
    await enviar(ana, Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>'), 'logo.svg', 'image/svg+xml').expect(415);
    await enviar(ana, Buffer.from('<html><script>alert(1)</script></html>'), 'a.png', 'image/png').expect(415);
  });

  it('PNG, JPEG e XLSX passam', async () => {
    const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(100)]);
    const jpg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(100)]);
    const wb = new ExcelJS.Workbook();
    wb.addWorksheet('A').addRow([1, 2]);
    const xlsx = Buffer.from(await wb.xlsx.writeBuffer());
    expect((await enviar(ana, png, 'a.png', 'image/png').expect(201)).body.tipo).toBe('image/png');
    expect((await enviar(ana, jpg, 'a.jpg', 'image/jpeg').expect(201)).body.tipo).toBe('image/jpeg');
    expect((await enviar(ana, xlsx, 'a.xlsx', 'application/octet-stream').expect(201)).body.nome).toBe('a.xlsx');
  });

  it('acima de UPLOAD_MAX_MB → 413 sem gravar nada (tamanho declarado e também fluxo sem Content-Length)', async () => {
    const antes = (await readdir(pasta)).length;
    const linhas = await linhasDeArquivo();
    const grande = Buffer.concat([Buffer.from('%PDF-1.7\n'), Buffer.alloc(2 * 1024 * 1024, 0x61)]);
    const res = await enviar(beto, grande).catch((e: NodeJS.ErrnoException) => ({ status: e.code === 'EPIPE' || e.code === 'ECONNRESET' ? 0 : -1 }));
    expect([413, 0]).toContain(res.status); // 0 = a conexão caiu antes de a resposta chegar (o servidor fecha de propósito)
    await app.listen(0);
    const porta = ((app.getHttpServer() as http.Server).address() as { port: number }).port;
    expect([413, 0]).toContain((await enviarEmPartes(porta, beto, 3 * 1024 * 1024)).status);
    expect((await readdir(pasta)).length).toBe(antes);
    expect(await linhasDeArquivo()).toBe(linhas);
  });

  it('exatamente no limite passa', async () => {
    const exato = Buffer.concat([Buffer.from('%PDF-1.7\n'), Buffer.alloc(1024 * 1024 - 9, 0x61)]);
    expect(exato.length).toBe(1024 * 1024);
    await enviar(beto, exato, 'exato.pdf').expect(201);
  });

  it('origem de outro site → 403 (CSRF); mais de um arquivo → 400', async () => {
    await request(app.getHttpServer())
      .post('/api/arquivos')
      .set('x-usuario-teste', comoUsuario(ana))
      .set('Origin', 'https://mal.exemplo.com')
      .attach('arquivo', PDF, 'a.pdf')
      .expect(403);
    await base(ana).post('/api/arquivos').attach('arquivo', PDF, 'a.pdf').attach('arquivo', PDF, 'b.pdf').expect(400);
  });

  it('limite por usuário: passou de UPLOAD_LIMITE_POR_MIN → 429 com Retry-After', async () => {
    for (let i = 0; i < 40; i++) await enviar(limitado, PDF, `n${i}.pdf`).expect(201);
    const res = await enviar(limitado, PDF, 'extra.pdf').expect(429);
    expect(Number(res.headers['retry-after'])).toBeGreaterThan(0);
    await enviar(beto, PDF, 'outro-usuario.pdf').expect(201);
  });
});

describe('quem vê, baixa e remove (dono e escopo checados no serviço)', () => {
  let privado: string;
  let daGestao: string;

  beforeAll(async () => {
    privado = (await enviar(ana, PDF, 'privado.pdf', 'application/pdf', 'PRIVADO').expect(201)).body.id as string;
    daGestao = (await enviar(ana, PDF, 'gestao.pdf', 'application/pdf', 'GESTAO').expect(201)).body.id as string;
  });

  const ids = async (u: Linha) => ((await base(u).get('/api/arquivos').expect(200)).body as { id: string }[]).map((a) => a.id);

  it('a lista mostra só o que o papel permite', async () => {
    const deAna = await ids(ana);
    expect(deAna).toEqual(expect.arrayContaining([privado, daGestao]));
    const deBeto = await ids(beto);
    expect(deBeto).not.toContain(privado);
    expect(deBeto).not.toContain(daGestao);
    const deGestor = await ids(gestor);
    expect(deGestor).toContain(daGestao);
    expect(deGestor).not.toContain(privado);
    expect(await ids(admin)).toEqual(expect.arrayContaining([privado, daGestao]));
  });

  it('baixar: dono sim; outro usuário e GESTOR (em arquivo privado) recebem 404, sem revelar que existe', async () => {
    await baixar(ana, privado).expect(200);
    await baixar(admin, privado).expect(200);
    await baixar(beto, privado).expect(404);
    await baixar(gestor, privado).expect(404);
    await baixar(gestor, daGestao).expect(200);
    await baixar(beto, daGestao).expect(404);
    await base(beto).get('/api/arquivos/00000000-0000-4000-8000-000000000000/download').expect(404);
    await base(beto).get('/api/arquivos/nao-e-uuid/download').expect(400);
    await request(app.getHttpServer()).get(`/api/arquivos/${privado}/download`).expect(401);
  });

  it('download sempre como anexo, nunca inline, com nosniff e sem cache', async () => {
    const res = await baixar(ana, privado).expect(200);
    expect((res.body as Buffer).equals(PDF)).toBe(true);
    expect(res.headers['content-type']).toBe('application/pdf');
    expect(res.headers['content-disposition']).toMatch(/^attachment; filename="privado\.pdf"; filename\*=UTF-8''privado\.pdf$/);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['cache-control']).toMatch(/no-store/);
    expect(res.headers['content-security-policy']).toMatch(/sandbox/);
    expect(res.headers['content-length']).toBe(String(PDF.length));
  });

  it('nome com aspas, quebra de linha e acentos não escapa do cabeçalho', async () => {
    const id = (await enviar(ana, PDF, 'a"b\r\nSet-Cookie: x=1;ç.pdf').expect(201)).body.id as string;
    const res = await baixar(ana, id).expect(200);
    expect(res.headers['set-cookie']).toBeUndefined();
    expect(res.headers['content-disposition']).toMatch(/^attachment; filename="[A-Za-z0-9._-]+"; filename\*=UTF-8''[A-Za-z0-9%._-]+$/);
  });

  it('remover: só o dono (ou ADMIN); depois some da lista e o download dá 404; objeto sai do armazenamento', async () => {
    const id = (await enviar(ana, PDF, 'descartavel.pdf').expect(201)).body.id as string;
    const chave = ((await dono.query('select chave from arquivo where id = $1', [id])).rows as { chave: string }[])[0]!.chave;
    await base(beto).delete(`/api/arquivos/${id}`).expect(404);
    await base(gestor).delete(`/api/arquivos/${id}`).expect(404);
    expect(await readdir(pasta)).toContain(chave);
    await base(ana).delete(`/api/arquivos/${id}`).expect(204);
    expect(await readdir(pasta)).not.toContain(chave);
    await baixar(ana, id).expect(404);
    expect(await ids(ana)).not.toContain(id);
    await base(ana).delete(`/api/arquivos/${id}`).expect(404);
    const outro = (await enviar(beto, PDF, 'do-beto.pdf').expect(201)).body.id as string;
    await base(admin).delete(`/api/arquivos/${outro}`).expect(204);
  });

  it('auditoria: arquivo.enviar, arquivo.baixar e arquivo.remover com ator e alvo, sem o caminho nem o conteúdo', async () => {
    const enviados = await eventosDe('arquivo.enviar');
    expect(enviados.length).toBeGreaterThan(5);
    const deste = enviados.find((e) => e.alvo_id === privado);
    expect(deste).toMatchObject({ ator_id: ana.id, alvo_tipo: 'arquivo' });
    expect(JSON.stringify(deste!.depois)).toContain('privado.pdf');
    expect(JSON.stringify(deste!.depois)).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.pdf/);
    const baixados = await eventosDe('arquivo.baixar');
    expect(baixados.some((e) => e.alvo_id === privado && e.ator_id === admin.id)).toBe(true);
    expect(baixados.some((e) => e.ator_id === beto.id && e.alvo_id === privado)).toBe(false); // recusado não deixa evento de download
    const removidos = await eventosDe('arquivo.remover');
    expect(removidos.length).toBeGreaterThanOrEqual(2);
    expect(removidos[0]).toMatchObject({ alvo_tipo: 'arquivo' });
  });
});

describe('URL assinada (armazenamento local: HMAC com expiração)', () => {
  let id: string;
  beforeAll(async () => {
    id = (await enviar(ana, PDF, 'com-link.pdf').expect(201)).body.id as string;
  });

  it('só quem pode ver o arquivo recebe o link; o link baixa sem sessão, como anexo, e fica na auditoria', async () => {
    await base(beto).post(`/api/arquivos/${id}/link`).expect(404);
    await request(app.getHttpServer()).post(`/api/arquivos/${id}/link`).set('Origin', PAINEL).expect(401);
    const res = await base(ana).post(`/api/arquivos/${id}/link`).expect(200);
    expect(res.body.url).toMatch(/^\/api\/arquivos\/assinado\/[0-9a-f-]{36}\.pdf\?exp=\d+&sig=[0-9a-f]{64}$/);
    expect(new Date(res.body.expiraEm as string).getTime()).toBeGreaterThan(Date.now());
    const baixado = await request(app.getHttpServer())
      .get(res.body.url as string)
      .buffer(true)
      .parse((r, cb) => {
        const partes: Buffer[] = [];
        r.on('data', (p: Buffer) => partes.push(p));
        r.on('end', () => cb(null, Buffer.concat(partes)));
      })
      .expect(200);
    expect((baixado.body as Buffer).equals(PDF)).toBe(true);
    expect(baixado.headers['content-disposition']).toMatch(/^attachment; filename="com-link\.pdf"/);
    expect(baixado.headers['x-content-type-options']).toBe('nosniff');
    const baixas = await eventosDe('arquivo.baixar');
    expect(baixas.some((e) => e.alvo_id === id && JSON.stringify(e.depois).includes('link'))).toBe(true);
  });

  it('assinatura adulterada, expiração trocada ou chave de outro arquivo → 403', async () => {
    const url = (await base(ana).post(`/api/arquivos/${id}/link`).expect(200)).body.url as string;
    const u = new URL(url, 'http://x');
    const sig = u.searchParams.get('sig')!;
    const exp = u.searchParams.get('exp')!;
    await request(app.getHttpServer()).get(`${u.pathname}?exp=${exp}&sig=${sig.slice(0, -1)}${sig.endsWith('0') ? '1' : '0'}`).expect(403);
    await request(app.getHttpServer()).get(`${u.pathname}?exp=${Number(exp) + 3600}&sig=${sig}`).expect(403);
    await request(app.getHttpServer()).get(`${u.pathname}`).expect(403);
    await request(app.getHttpServer()).get(`/api/arquivos/assinado/../../etc/passwd?exp=${exp}&sig=${sig}`).expect((r) => expect([403, 404]).toContain(r.status));
    const outraChave = '00000000-0000-4000-8000-000000000000.pdf';
    await request(app.getHttpServer()).get(`/api/arquivos/assinado/${outraChave}?exp=${exp}&sig=${sig}`).expect(403);
  });

  it('link de arquivo removido deixa de funcionar', async () => {
    const outro = (await enviar(ana, PDF, 'efemero.pdf').expect(201)).body.id as string;
    const url = (await base(ana).post(`/api/arquivos/${outro}/link`).expect(200)).body.url as string;
    await base(ana).delete(`/api/arquivos/${outro}`).expect(204);
    await request(app.getHttpServer()).get(url).expect(404);
  });
});

describe('antivírus ClamAV (ANTIVIRUS_HABILITADO=true)', () => {
  const objetosNoDisco = async () => (await readdir(pastaAv)).filter((f) => !f.startsWith('.'));

  it('arquivo limpo é varrido e liberado', async () => {
    clamd.modo('normal');
    const antes = clamd.varreduras();
    const res = await enviar(ana, PDF, 'limpo.pdf', 'application/pdf', undefined, appAv).expect(201);
    expect(clamd.varreduras()).toBe(antes + 1);
    expect(res.body.varredura).toBe('LIMPO');
    await base(ana, appAv).get(`/api/arquivos/${res.body.id as string}/download`).expect(200);
  });

  it('infectado → 422, o objeto é apagado (quarentena não vira arquivo) e fica na auditoria', async () => {
    clamd.modo('normal');
    const linhas = await linhasDeArquivo();
    const res = await enviar(ana, Buffer.concat([PDF, Buffer.from(EICAR_TESTE)]), 'eicar.pdf', 'application/pdf', undefined, appAv).expect(422);
    expect(res.body.erro).toMatch(/vírus|ameaça/i);
    expect(await objetosNoDisco()).toHaveLength(1); // só o "limpo.pdf" do teste anterior
    expect(await linhasDeArquivo()).toBe(linhas);
    const bloqueios = await eventosDe('arquivo.bloquear');
    expect(bloqueios.at(-1)).toMatchObject({ ator_id: ana.id });
    expect(JSON.stringify(bloqueios.at(-1)!.depois)).toContain('Eicar-Test-Signature');
  });

  it('falha fechada: ClamAV com erro, mudo ou fora do ar → 503 e nada fica guardado', async () => {
    const linhas = await linhasDeArquivo();
    const antes = await objetosNoDisco();
    clamd.modo('erro');
    await enviar(ana, PDF, 'a.pdf', 'application/pdf', undefined, appAv).expect(503);
    await clamd.parar();
    await enviar(ana, PDF, 'b.pdf', 'application/pdf', undefined, appAv).expect(503);
    expect(await objetosNoDisco()).toEqual(antes);
    expect(await linhasDeArquivo()).toBe(linhas);
    clamd = await subirClamdFalso(); // religa só para o afterAll ter o que parar
  });

  it('sem antivírus configurado, o upload não varre e marca NAO_VARRIDO', async () => {
    const res = await enviar(ana, PDF, 'sem-av.pdf').expect(201);
    expect(res.body.varredura).toBe('NAO_VARRIDO');
  });
});
