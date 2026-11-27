import { existsSync } from 'node:fs';
import path from 'node:path';

/**
 * Conveniência de desenvolvimento: carrega o primeiro .env encontrado (apps/api/.env ou o da raiz do monorepo).
 * Variáveis já definidas no ambiente têm precedência. Em produção (Docker) não há .env: tudo vem do ambiente.
 */
export function carregarArquivoEnv(cwd: string = process.cwd()): void {
  for (const candidato of [path.join(cwd, '.env'), path.join(cwd, '..', '..', '.env')]) {
    if (existsSync(candidato)) {
      process.loadEnvFile(candidato);
      return;
    }
  }
}
