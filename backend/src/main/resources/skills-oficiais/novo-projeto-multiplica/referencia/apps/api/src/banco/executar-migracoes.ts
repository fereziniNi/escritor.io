// origem: skills-modelo/apps/api/src/banco/executar-migracoes.ts
// Ponto de entrada das migrações: `pnpm --filter api db:migrate` (dev) ou `node dist/banco/executar-migracoes.js`
// (serviço "migracao" do compose, que roda uma vez antes da API).
import { carregarArquivoEnv } from '../config/arquivo-env';
import { carregarConfig } from '../config/config';
import { migrarBanco } from './migrar';

carregarArquivoEnv();

const linha = (dados: Record<string, unknown>) => `${JSON.stringify({ time: Date.now(), ...dados })}\n`;

migrarBanco(carregarConfig().DATABASE_URL.revelar()).then(
  () => process.stdout.write(linha({ level: 'info', msg: 'migrações aplicadas' })),
  (e: unknown) => {
    process.stderr.write(linha({ level: 'fatal', msg: 'falha nas migrações', erro: (e as Error).message }));
    process.exit(1);
  },
);
