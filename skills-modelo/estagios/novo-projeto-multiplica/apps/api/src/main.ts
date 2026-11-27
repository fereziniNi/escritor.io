import 'reflect-metadata';
import { carregarArquivoEnv } from './config/arquivo-env';
import { type Config, ErroConfiguracao, carregarConfig } from './config/config';
import { criarApp } from './criar-app';

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

async function iniciar(): Promise<void> {
  const config = lerConfig();
  const app = await criarApp(config);
  await app.listen(config.PORT);
}

iniciar().catch((e: unknown) => fatal('Falha ao iniciar a API', { erro: e instanceof Error ? e.message : String(e) }));
