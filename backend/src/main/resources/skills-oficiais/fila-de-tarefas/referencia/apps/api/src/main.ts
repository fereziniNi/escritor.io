// origem: skills-modelo/apps/api/src/main.ts
import 'reflect-metadata';
import { carregarArquivoEnv } from './config/arquivo-env';
import { type Config, ErroConfiguracao, carregarConfig } from './config/config';
import { criarApp } from './criar-app';
import { migrarBanco } from './banco/migrar';
import { type PapelProcesso, resolverPapel, servePortaHttp } from './fila/papel';
import { prepararFila } from './fila/preparar-fila';

/** Erro de inicialização em JSON (o logger do Nest ainda não existe aqui). */
function fatal(msg: string, extra: Record<string, unknown> = {}): never {
  process.stderr.write(`${JSON.stringify({ level: 'fatal', time: Date.now(), msg, ...extra })}\n`);
  process.exit(1);
}

function lerConfig(): Config {
  carregarArquivoEnv();
  try {
    return carregarConfig();
  } catch (e) {
    if (e instanceof ErroConfiguracao) fatal('Configuração inválida', { problemas: e.problemas });
    throw e;
  }
}

function lerPapel(config: Config): PapelProcesso {
  try {
    return resolverPapel(config);
  } catch (e) {
    return fatal('ROLE inválida', { erro: (e as Error).message });
  }
}

async function iniciar(): Promise<void> {
  const config = lerConfig();
  const papel = lerPapel(config);
  if (papel === 'migrar') {
    // Serviço "migracao" do compose: migrações do banco e schema da fila, os dois com o DONO (DATABASE_URL); termina ao acabar.
    await migrarBanco(config.DATABASE_URL.revelar());
    await prepararFila(config.DATABASE_URL.revelar(), { conceder: true });
    process.stdout.write(`${JSON.stringify({ level: 'info', time: Date.now(), msg: 'migrações e fila preparadas' })}\n`);
    return;
  }
  const app = await criarApp(config);
  // worker: sem porta; as tarefas começam no onApplicationBootstrap da fila e o SIGTERM encerra com as tarefas em andamento.
  if (servePortaHttp(papel)) await app.listen(config.PORT);
  else await app.init();
}

iniciar().catch((e: unknown) => fatal('Falha ao iniciar a API', { erro: e instanceof Error ? e.message : String(e) }));
