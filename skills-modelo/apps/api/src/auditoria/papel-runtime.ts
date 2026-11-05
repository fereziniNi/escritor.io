import { type Config } from '../config/config';

/**
 * Falha fechada: fora de desenvolvimento a API só sobe com o papel de runtime (`DATABASE_URL_RUNTIME`). Sem ele ela
 * rodaria como o dono do banco, e o dono ignora o REVOKE: a trilha ficaria protegida só pelo gatilho. Só `NODE_ENV`
 * `development` ou `test` DECLARADOS (o valor cru, `NODE_ENV_DECLARADO`) dispensam; ausente ou vazio conta como produção.
 * Chamado no construtor do AuditoriaService: lançar aqui derruba a subida, com a mensagem abaixo no log.
 */
export function exigirPapelRuntime(config: Config): void {
  if (config.DATABASE_URL_RUNTIME !== undefined) return;
  if (config.NODE_ENV_DECLARADO === 'development' || config.NODE_ENV_DECLARADO === 'test') return;
  throw new Error(
    'DATABASE_URL_RUNTIME (ou DATABASE_URL_RUNTIME_ARQUIVO) é obrigatória fora de desenvolvimento: sem o papel de runtime ' +
      '(app_runtime) a API usaria o usuário dono do banco e o REVOKE da auditoria não valeria. ' +
      '(NODE_ENV ausente conta como produção; em dev declare NODE_ENV=development.)',
  );
}
