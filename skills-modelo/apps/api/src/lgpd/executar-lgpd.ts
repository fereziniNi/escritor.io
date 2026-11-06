// Comandos LGPD fora da API (rodam e terminam):
//   pnpm --filter api lgpd:retencao   (produção: node dist/lgpd/executar-lgpd.js retencao)
//   pnpm --filter api lgpd:recifrar   (produção: node dist/lgpd/executar-lgpd.js recifrar)
// retencao: RETENCAO_DIAS com o papel de runtime; RETENCAO_AUDITORIA_IP_DIAS com o DONO (DATABASE_URL), por isso rode
// onde o dono está disponível (o serviço de migração), nunca de dentro do contêiner da API.
import { carregarArquivoEnv } from '../config/arquivo-env';
import { carregarConfig } from '../config/config';
import { criarBanco } from '../banco/banco';
import { carregarChavesLgpd } from './chaves';
import { recifrarClientes } from './recifrar';
import { executarRetencao, expurgarIpAuditoria } from './retencao';

const linha = (dados: Record<string, unknown>) => `${JSON.stringify({ time: Date.now(), ...dados })}\n`;

async function executar(comando: string | undefined): Promise<void> {
  carregarArquivoEnv();
  const config = carregarConfig();
  const db = criarBanco((config.DATABASE_URL_RUNTIME ?? config.DATABASE_URL).revelar());
  try {
    if (comando === 'retencao') {
      const r = await executarRetencao({ db, config });
      process.stdout.write(linha({ level: 'info', msg: r.ligada ? 'retenção aplicada' : 'RETENCAO_DIAS não definida: nada expurgado', ...r }));
      if (config.RETENCAO_AUDITORIA_IP_DIAS !== undefined) {
        const dono = criarBanco(config.DATABASE_URL.revelar());
        try {
          const n = await expurgarIpAuditoria(dono, config.RETENCAO_AUDITORIA_IP_DIAS);
          process.stdout.write(linha({ level: 'info', msg: 'IP expurgado da trilha de auditoria', linhas: n }));
        } finally {
          await dono.$client.end();
        }
      }
    } else if (comando === 'recifrar') {
      if (config.DADOS_CHAVES === undefined) throw new Error('recifrar exige DADOS_CHAVES e DADOS_CHAVE_INDICE definidas');
      const n = await recifrarClientes(db, carregarChavesLgpd(config).chaveiro);
      process.stdout.write(linha({ level: 'info', msg: 're-cifrado com a chave ativa', linhas: n }));
    } else {
      throw new Error('uso: executar-lgpd.ts retencao | recifrar');
    }
  } finally {
    await db.$client.end();
  }
}

executar(process.argv[2]).catch((e: unknown) => {
  // Só a mensagem: nunca o objeto inteiro (poderia carregar parâmetros da consulta).
  process.stderr.write(linha({ level: 'fatal', msg: 'falha no comando LGPD', erro: e instanceof Error ? e.message : String(e) }));
  process.exit(1);
});
