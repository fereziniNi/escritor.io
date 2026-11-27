import { type IncomingMessage, type Server, type ServerResponse, createServer } from 'node:http';
import { type INestApplication } from '@nestjs/common';
import { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { BANCO, type Db } from '../src/banco/banco';
import { usuario } from '../src/banco/esquema';
import { carregarConfig } from '../src/config/config';
import { criarApp } from '../src/criar-app';
import { subirPostgres } from './postgres';
import { comoUsuario, exporUsuarioDeTeste } from './usuario-de-teste';

const PAINEL = 'https://painel.exemplo.com.br';
const TEXTO = 'Relatório mensal: vendas cresceram 12% e o cliente 123.456.789-09 renovou o contrato.';

let parar: () => Promise<void>;
let dono: Pool;
let app: INestApplication;
let db: Db;
let llm: Server;
let chamadasLlm = 0;
let motivoParada = 'end_turn';
type Linha = typeof usuario.$inferSelect;
let admin: Linha;
let gestor: Linha;
let comum: Linha;

const http = () => request(app.getHttpServer());
const resumir = (como: Linha | null, corpo: unknown = { texto: TEXTO }, origem: string | null = PAINEL) => {
  let r = http().post('/api/ia/resumir');
  if (como) r = r.set('x-usuario-teste', comoUsuario(como));
  if (origem) r = r.set('Origin', origem);
  return r.send(corpo as object);
};

async function criarUsuario(email: string, papel: 'ADMIN' | 'GESTOR' | 'USUARIO'): Promise<Linha> {
  const [l] = await db.insert(usuario).values({ email, nome: 'Fulana', papel, ativo: true }).returning();
  return l!;
}

beforeAll(async () => {
  llm = createServer((req: IncomingMessage, res: ServerResponse) => {
    chamadasLlm += 1;
    req.resume();
    req.on('end', () => {
      res.setHeader('content-type', 'application/json');
      res.end(
        JSON.stringify({
          id: 'msg_1',
          type: 'message',
          role: 'assistant',
          model: 'claude-sonnet-5-5',
          content: [{ type: 'text', text: 'Vendas subiram 12%.' }],
          stop_reason: motivoParada,
          stop_sequence: null,
          usage: { input_tokens: 500, output_tokens: 50 },
        }),
      );
    });
  });
  await new Promise<void>((ok) => llm.listen(0, '127.0.0.1', ok));
  const urlLlm = `http://127.0.0.1:${(llm.address() as { port: number }).port}`;

  const banco = await subirPostgres();
  parar = banco.parar;
  dono = new Pool({ connectionString: banco.url, max: 2 });
  const config = carregarConfig({
    DATABASE_URL: banco.url,
    DATABASE_URL_RUNTIME: banco.urlRuntime,
    NODE_ENV: 'test',
    LOG_LEVEL: 'silent',
    CORS_ORIGENS: PAINEL,
    IA_HABILITADA: 'true',
    ANTHROPIC_API_KEY: 'chave-de-teste',
    LITELLM_URL: urlLlm,
    IA_LIMITE_POR_MIN: '3',
  });
  app = await criarApp(config);
  exporUsuarioDeTeste(app);
  await app.init();
  db = app.get<Db>(BANCO);
  admin = await criarUsuario('admin@exemplo.com.br', 'ADMIN');
  gestor = await criarUsuario('gestor@exemplo.com.br', 'GESTOR');
  comum = await criarUsuario('comum@exemplo.com.br', 'USUARIO');
});

afterAll(async () => {
  await app?.close();
  await dono?.end();
  await parar?.();
  await new Promise((ok) => llm?.close(ok));
});

describe('POST /api/ia/resumir', () => {
  it('sem login: 401; USUARIO: 403; nenhuma chamada ao modelo', async () => {
    const antes = chamadasLlm;
    expect((await resumir(null)).status).toBe(401);
    expect((await resumir(comum)).status).toBe(403);
    expect(chamadasLlm).toBe(antes);
  });

  it('origem de outro site: 403 sem chamar o modelo', async () => {
    const antes = chamadasLlm;
    expect((await resumir(admin, { texto: TEXTO }, 'https://malvado.example.net')).status).toBe(403);
    expect(chamadasLlm).toBe(antes);
  });

  it('corpo inválido: 400', async () => {
    expect((await resumir(admin, { texto: '' })).status).toBe(400);
    expect((await resumir(admin, { texto: 'x'.repeat(20_001) })).status).toBe(400);
  });

  it('ADMIN resume pelo modelo configurado e a trilha guarda só metadados (sem o texto)', async () => {
    const res = await resumir(admin);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ resumo: 'Vendas subiram 12%.', modelo: 'claude-sonnet-5-5' });
    const { rows } = await dono.query('select * from evento_auditoria where acao = $1 order by id desc limit 1', ['ia.resumir']);
    expect(rows).toHaveLength(1);
    expect(rows[0].ator_id).toBe(admin.id);
    expect(rows[0].depois).toMatchObject({ modelo: 'claude-sonnet-5-5', usoEntrada: 500, usoSaida: 50, caracteres: TEXTO.length });
    const tudo = JSON.stringify(rows[0]);
    expect(tudo).not.toContain('123.456.789-09');
    expect(tudo).not.toContain('Vendas subiram');
    expect(tudo).not.toContain('Relatório mensal');
  });

  it('resposta cortada (max_tokens) ou recusada: 502 e nada na trilha como resumo feito', async () => {
    const outro = await criarUsuario('admin2@exemplo.com.br', 'ADMIN');
    const contar = async () => Number((await dono.query("select count(*) from evento_auditoria where acao = 'ia.resumir'")).rows[0].count);
    const antes = await contar();
    try {
      for (const motivo of ['max_tokens', 'refusal']) {
        motivoParada = motivo;
        const res = await resumir(outro);
        expect(res.status).toBe(502);
        expect(JSON.stringify(res.body)).not.toContain('Vendas subiram');
      }
    } finally {
      motivoParada = 'end_turn';
    }
    expect(await contar()).toBe(antes);
  });

  it('limite por usuário: o 4º pedido do GESTOR no minuto dá 429 com Retry-After', async () => {
    for (let i = 0; i < 3; i++) expect((await resumir(gestor)).status).toBe(200);
    const res = await resumir(gestor);
    expect(res.status).toBe(429);
    expect(Number(res.headers['retry-after'])).toBeGreaterThan(0);
  });
});
