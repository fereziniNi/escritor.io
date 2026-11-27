// origem: skills-modelo/apps/api/src/armazenamento/fabrica.ts
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { Logger } from '@nestjs/common';
import { type Config } from '../config/config';
import { type Antivirus, AntivirusClamav } from './antivirus';
import { type Armazenamento } from './armazenamento';
import { ArmazenamentoAzure } from './armazenamento-azure';
import { ArmazenamentoLocal } from './armazenamento-local';
import { ArmazenamentoS3 } from './armazenamento-s3';

/** Rota do app que serve o link assinado do armazenamento local (ArquivosController). */
export const PREFIXO_LINK_LOCAL = '/api/arquivos/assinado';

/**
 * Segredo do link assinado do armazenamento local. FALHA FECHADA como o segredo do login: sem ARMAZENAMENTO_SEGREDO_URL a API
 * não sobe, salvo com NODE_ENV development ou test DECLARADOS (aí um segredo aleatório deste processo; os links não valem
 * depois de reiniciar).
 */
export function segredoDoLinkLocal(config: Config): string {
  const segredo = config.ARMAZENAMENTO_SEGREDO_URL?.revelar();
  if (segredo !== undefined) return segredo;
  if (config.NODE_ENV_DECLARADO !== 'development' && config.NODE_ENV_DECLARADO !== 'test') {
    throw new Error(
      'ARMAZENAMENTO_SEGREDO_URL (ou ARMAZENAMENTO_SEGREDO_URL_ARQUIVO) é obrigatória fora de desenvolvimento com ARMAZENAMENTO_TIPO=local: ' +
        'sem ela o link de download não pode ser assinado. (NODE_ENV ausente conta como produção.)',
    );
  }
  new Logger('Armazenamento').warn('ARMAZENAMENTO_SEGREDO_URL ausente: segredo aleatório deste processo (só dev/teste; os links expiram ao reiniciar)');
  return randomBytes(32).toString('hex');
}

/** Monta o armazenamento escolhido em ARMAZENAMENTO_TIPO. A validação das variáveis de cada tipo já foi feita no carregarConfig. */
export function criarArmazenamento(config: Config): Armazenamento {
  if (config.ARMAZENAMENTO_TIPO === 's3') {
    return new ArmazenamentoS3({
      ...(config.S3_ENDPOINT ? { endpoint: config.S3_ENDPOINT } : {}),
      regiao: config.S3_REGION,
      bucket: config.S3_BUCKET!,
      accessKeyId: config.S3_ACCESS_KEY!,
      secretAccessKey: config.S3_SECRET_KEY!.revelar(),
      forcePathStyle: config.S3_PATH_STYLE,
    });
  }
  if (config.ARMAZENAMENTO_TIPO === 'azure') {
    return new ArmazenamentoAzure({ connectionString: config.AZURE_CONNECTION_STRING!.revelar(), container: config.AZURE_CONTAINER! });
  }
  return new ArmazenamentoLocal({ pasta: path.resolve(config.ARMAZENAMENTO_PASTA), segredoUrl: segredoDoLinkLocal(config), prefixoUrl: PREFIXO_LINK_LOCAL });
}

/** ClamAV quando ANTIVIRUS_HABILITADO=true; senão null (o serviço marca o arquivo como NAO_VARRIDO). */
export const criarAntivirus = (config: Config): Antivirus | null =>
  config.ANTIVIRUS_HABILITADO ? new AntivirusClamav({ host: config.CLAMAV_HOST, porta: config.CLAMAV_PORTA }) : null;
