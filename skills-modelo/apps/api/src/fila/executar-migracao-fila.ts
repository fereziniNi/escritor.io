// Só a fila, com o DONO do banco: `pnpm --filter api fila:migrar` (produção: node dist/fila/executar-migracao-fila.js).
// Rode DEPOIS das migrações do banco (db:migrate): é ela que cria o papel app_runtime. O mesmo passo roda com ROLE=migrar.
import { carregarArquivoEnv } from '../config/arquivo-env';
import { carregarConfig } from '../config/config';
import { prepararFila } from './preparar-fila';

carregarArquivoEnv();

const linha = (dados: Record<string, unknown>) => `${JSON.stringify({ time: Date.now(), ...dados })}\n`;

prepararFila(carregarConfig().DATABASE_URL.revelar(), { conceder: true }).then(
  () => process.stdout.write(linha({ level: 'info', msg: 'fila preparada' })),
  (e: unknown) => {
    process.stderr.write(linha({ level: 'fatal', msg: 'falha ao preparar a fila', erro: (e as Error).message }));
    process.exit(1);
  },
);
