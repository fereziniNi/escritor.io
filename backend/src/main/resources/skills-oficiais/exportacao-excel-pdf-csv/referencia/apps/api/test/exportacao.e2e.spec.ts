// origem: skills-modelo/apps/api/test/exportacao.e2e.spec.ts
import { randomBytes } from 'node:crypto';
import { type INestApplication } from '@nestjs/common';
import ExcelJS from 'exceljs';
import { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { AuditoriaService } from '../src/auditoria/auditoria.service';
import { BANCO, type Db } from '../src/banco/banco';
import { ClientesService } from '../src/clientes/clientes.service';
import { usuario } from '../src/banco/esquema';
import { type Config, carregarConfig } from '../src/config/config';
import { criarApp } from '../src/criar-app';
import { mascararCpf, mascararEmail } from '../src/lgpd/mascarar';
import { subirPostgres } from './postgres';
import { extrairTextoPdf } from './texto-pdf';
import { comoUsuario, exporUsuarioDeTeste } from './usuario-de-teste';

const PAINEL = 'https://painel.exemplo.com.br';
const CPF = '12345678909';
const EMAIL = 'ana.souza@exemplo.com.br';
const MAX = 4;
const OUTROS_CPFS = ['52998224725', '11144477735', '39053344705', '16899535009'];

const chave = () => randomBytes(32).toString('base64');

let urlDono: string;
let urlRuntime: string;
let parar: () => Promise<void>;
let dono: Pool;
let app: INestApplication;
let db: Db;
let config: Config;

type Linha = typeof usuario.$inferSelect;
let admin: Linha;
let gestor: Linha;
let comum: Linha;

const http = () => request(app.getHttpServer());
const cab = (u: Linha) => comoUsuario(u);

async function criarUsuario(email: string, papel: 'ADMIN' | 'GESTOR' | 'USUARIO'): Promise<Linha> {
  const [linha] = await db.insert(usuario).values({ email, nome: 'Fulana', papel, ativo: true }).returning();
  return linha!;
}

async function criarCliente(cpf: string, nome: string, email: string) {
  const res = await http().post('/api/clientes').set('x-usuario-teste', cab(gestor)).set('Origin', PAINEL).send({ nome, email, cpf });
  expect(res.status).toBe(201);
}

const exportar = (formato: string, como: Linha) =>
  http()
    .get('/api/clientes/exportar')
    .query({ formato })
    .set('x-usuario-teste', cab(como))
    .buffer(true)
    .parse((res, cb) => {
      const partes: Buffer[] = [];
      res.on('data', (p: Buffer) => partes.push(p));
      res.on('end', () => cb(null, Buffer.concat(partes)));
    });

async function eventosDe(acao: string) {
  return (await dono.query('select * from evento_auditoria where acao = $1 order by id desc', [acao])).rows as Record<string, unknown>[];
}

async function lerXlsx(corpo: Buffer): Promise<string[][]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(corpo as unknown as ArrayBuffer);
  const linhas: string[][] = [];
  wb.worksheets[0]!.eachRow((l) => linhas.push((l.values as unknown[]).slice(1).map((v) => (v === null || v === undefined ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v as string | number)))));
  return linhas;
}

beforeAll(async () => {
  ({ url: urlDono, urlRuntime, parar } = await subirPostgres());
  dono = new Pool({ connectionString: urlDono, max: 2 });
  config = carregarConfig({
    DATABASE_URL: urlDono,
    DATABASE_URL_RUNTIME: urlRuntime,
    NODE_ENV: 'test',
    LOG_LEVEL: 'silent',
    CORS_ORIGENS: PAINEL,
    NOME_SISTEMA: 'Sistema Exemplo',
    DADOS_CHAVES: `k1:${chave()}`,
    DADOS_CHAVE_INDICE: chave(),
    EXPORTACAO_MAX_LINHAS: String(MAX),
  });
  app = await criarApp(config);
  exporUsuarioDeTeste(app);
  await app.init();
  db = app.get<Db>(BANCO);
  admin = await criarUsuario('admin@exemplo.com.br', 'ADMIN');
  gestor = await criarUsuario('gestor@exemplo.com.br', 'GESTOR');
  comum = await criarUsuario('comum@exemplo.com.br', 'USUARIO');
  await criarCliente(CPF, 'Ana Conceição', EMAIL);
  await criarCliente(OUTROS_CPFS[0]!, '=HYPERLINK("http://mal.exemplo.com")', 'beto@exemplo.com.br');
});

afterAll(async () => {
  await app?.close().catch(() => undefined);
  await dono?.end().catch(() => undefined);
  await parar?.();
});

describe('GET /api/clientes/exportar: acesso e cabeçalhos', () => {
  it('sem sessão → 401; formato desconhecido ou ausente → 400', async () => {
    await http().get('/api/clientes/exportar?formato=csv').expect(401);
    await http().get('/api/clientes/exportar?formato=docx').set('x-usuario-teste', cab(admin)).expect(400);
    await http().get('/api/clientes/exportar').set('x-usuario-teste', cab(admin)).expect(400);
  });

  it('anexo sem cache, com tipo certo e Content-Disposition seguro', async () => {
    const res = await exportar('csv', admin).expect(200);
    expect(res.headers['content-type']).toMatch(/^text\/csv; charset=utf-8/);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.headers['content-disposition']).toMatch(/^attachment; filename="clientes-\d{8}\.csv"; filename\*=UTF-8''clientes-\d{8}\.csv$/);
    expect(res.headers['x-exportacao-truncada']).toBe('false');
    const xlsx = await exportar('xlsx', admin).expect(200);
    expect(xlsx.headers['content-type']).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    const pdf = await exportar('pdf', admin).expect(200);
    expect(pdf.headers['content-type']).toBe('application/pdf');
    expect((pdf.body as Buffer).subarray(0, 4).toString('latin1')).toBe('%PDF');
  });
});

describe('a exportação respeita a máscara de dados pessoais do papel (LGPD)', () => {
  it('CSV: GESTOR e ADMIN recebem CPF e e-mail completos', async () => {
    for (const quem of [gestor, admin]) {
      const texto = ((await exportar('csv', quem).expect(200)).body as Buffer).toString('utf8');
      expect(texto).toContain(CPF);
      expect(texto).toContain(EMAIL);
    }
  });

  it('CSV: USUARIO recebe CPF e e-mail mascarados, o completo não aparece em lugar nenhum do arquivo', async () => {
    const texto = ((await exportar('csv', comum).expect(200)).body as Buffer).toString('utf8');
    expect(texto).toContain(mascararCpf(CPF));
    expect(texto).toContain(mascararEmail(EMAIL));
    for (const proibido of [CPF, '123.456.789', EMAIL, 'ana.souza']) expect(texto).not.toContain(proibido);
  });

  it('Excel: USUARIO recebe mascarado em todas as células; GESTOR recebe completo', async () => {
    const mascarado = JSON.stringify(await lerXlsx(((await exportar('xlsx', comum).expect(200)).body as Buffer)));
    expect(mascarado).toContain(mascararCpf(CPF));
    for (const proibido of [CPF, EMAIL]) expect(mascarado).not.toContain(proibido);
    const completo = JSON.stringify(await lerXlsx(((await exportar('xlsx', gestor).expect(200)).body as Buffer)));
    expect(completo).toContain(CPF);
    expect(completo).toContain(EMAIL);
  });

  it('PDF: USUARIO recebe mascarado (texto extraído), com acentos (Conceição) renderizados', async () => {
    const { texto } = await extrairTextoPdf((await exportar('pdf', comum).expect(200)).body as Buffer);
    // O pdfjs separa o texto por trechos ("*** .456.789-**"): compara sem espaços.
    expect(texto.replace(/\s+/g, '')).toContain(mascararCpf(CPF));
    expect(texto).toContain('Ana Conceição');
    expect(texto).toContain('Sistema Exemplo');
    expect(texto).not.toContain(CPF);
    expect(texto).not.toContain(EMAIL);
    const completo = await extrairTextoPdf((await exportar('pdf', admin).expect(200)).body as Buffer);
    expect(completo.texto).toContain(CPF);
  });
});

describe('nome de cliente que parece fórmula', () => {
  it('CSV leva apóstrofo; no Excel o texto fica literal (sem apóstrofo) e a célula não é fórmula', async () => {
    const csv = ((await exportar('csv', admin).expect(200)).body as Buffer).toString('utf8');
    expect(csv).toContain(`"'=HYPERLINK(""http://mal.exemplo.com"")"`);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load((await exportar('xlsx', admin).expect(200)).body);
    const textos: string[] = [];
    let formulas = 0;
    wb.worksheets[0]!.eachRow((l) =>
      l.eachCell((c) => {
        if (typeof c.value === 'string') textos.push(c.value);
        if (c.formula) formulas++;
      }),
    );
    expect(textos).toContain('=HYPERLINK("http://mal.exemplo.com")');
    expect(formulas).toBe(0);
  });
});

describe('exportação é auditada (cliente.exportar)', () => {
  it('cada exportação grava ator, formato e quantidade, sem dado pessoal; recusada não deixa evento', async () => {
    const antes = (await eventosDe('cliente.exportar')).length;
    await exportar('csv', comum).expect(200);
    const [evento] = await eventosDe('cliente.exportar');
    expect(evento).toMatchObject({ ator_id: comum.id, alvo_tipo: 'cliente', depois: { formato: 'csv', linhas: 2, truncado: false, mascarado: true } });
    await exportar('xlsx', admin).expect(200);
    const [ultimo] = await eventosDe('cliente.exportar');
    expect(ultimo).toMatchObject({ ator_id: admin.id, depois: { formato: 'xlsx', mascarado: false } });
    await http().get('/api/clientes/exportar?formato=docx').set('x-usuario-teste', cab(admin)).expect(400);
    expect((await eventosDe('cliente.exportar')).length).toBe(antes + 2);
    const trilha = JSON.stringify(await eventosDe('cliente.exportar'));
    for (const proibido of [CPF, EMAIL, 'Conceição']) expect(trilha).not.toContain(proibido);
  });
});

describe('limite de linhas (EXPORTACAO_MAX_LINHAS)', () => {
  it('acima do limite o arquivo sai cortado, o cabeçalho X-Exportacao-Truncada avisa e a trilha registra', async () => {
    for (const [i, cpf] of OUTROS_CPFS.slice(1).entries()) await criarCliente(cpf, `Cliente ${i + 3}`, `c${i + 3}@exemplo.com.br`);
    // 2 + 3 = 5 clientes; o limite é 4.
    const res = await exportar('csv', admin).expect(200);
    expect(res.headers['x-exportacao-truncada']).toBe('true');
    const linhas = (res.body as Buffer).toString('utf8').slice(1).trim().split('\r\n');
    expect(linhas).toHaveLength(1 + MAX);
    const [evento] = await eventosDe('cliente.exportar');
    expect(evento).toMatchObject({ depois: { formato: 'csv', linhas: MAX, truncado: true } });
    expect(((await lerXlsx((await exportar('xlsx', admin).expect(200)).body as Buffer))).length).toBeGreaterThanOrEqual(MAX);
  });
});

describe('trilha antes do corpo', () => {
  it('se a auditoria falhar, nada é enviado (500 sem arquivo) e o evento não existe', async () => {
    const espiao = vi.spyOn(app.get(AuditoriaService), 'registrar').mockRejectedValueOnce(new Error('trilha fora'));
    const antes = (await eventosDe('cliente.exportar')).length;
    const res = await exportar('csv', admin);
    espiao.mockRestore();
    expect(res.status).toBe(500);
    expect(res.headers['content-disposition']).toBeUndefined();
    expect((res.body as Buffer).toString('utf8')).not.toContain('Nome;');
    expect((await eventosDe('cliente.exportar')).length).toBe(antes);
  });
});

describe('leitura em lotes por chave (criado_em, id)', () => {
  it('1.200 clientes com o MESMO criado_em: nenhum repetido, nenhum perdido, ordem estável do mais novo ao mais velho', async () => {
    await dono.query("insert into cliente (nome, criado_em) select 'Lote ' || g, '2030-01-01 00:00:00.123456+00' from generate_series(1, 1200) g");
    try {
      const fonte = app.get<unknown>(ClientesService) as { lotesParaExportar(): AsyncIterable<{ nome: string }[]> };
      const nomes: string[] = [];
      let lotes = 0;
      for await (const lote of fonte.lotesParaExportar()) {
        lotes++;
        nomes.push(...lote.map((l) => l.nome));
      }
      expect(lotes).toBe(Math.ceil((1200 + 5) / 500));
      expect(nomes).toHaveLength(1200 + 5);
      expect(new Set(nomes).size).toBe(nomes.length);
      expect(nomes.slice(0, 1200).every((n) => n.startsWith('Lote '))).toBe(true);
    } finally {
      await dono.query("delete from cliente where nome like 'Lote %'");
    }
  });
});
