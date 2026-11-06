// origem: skills-modelo/apps/api/src/fila/papel.ts
import { type Config } from '../config/config';

/** O que um processo faz. `migrar` só cria o schema (banco e fila) e termina; os outros três sobem a aplicação. */
export type PapelProcesso = 'api' | 'worker' | 'tudo' | 'migrar';
export type PapelFila = Exclude<PapelProcesso, 'migrar'>;

/**
 * `ROLE` do processo. Falha fechada: vazio só vale como `tudo` com `NODE_ENV` `development` ou `test` DECLARADOS (o valor
 * cru, `NODE_ENV_DECLARADO`); ausente ou vazio conta como produção e a API não sobe (um `tudo` por engano em produção
 * duplicaria rotinas e ocuparia a API com tarefas pesadas).
 */
export function resolverPapel(config: Config): PapelProcesso {
  if (config.ROLE !== undefined) return config.ROLE;
  if (config.NODE_ENV_DECLARADO === 'development' || config.NODE_ENV_DECLARADO === 'test') return 'tudo';
  throw new Error(
    'ROLE é obrigatória fora de desenvolvimento: defina ROLE=api, ROLE=worker (ou ROLE=tudo num servidor pequeno). ' +
      '(NODE_ENV ausente conta como produção; em dev declare NODE_ENV=development.)',
  );
}

/** Quem tira tarefas da fila e dispara as rotinas agendadas. */
export const consomeFila = (papel: PapelProcesso): boolean => papel === 'worker' || papel === 'tudo';

/** Quem escuta a porta HTTP. */
export const servePortaHttp = (papel: PapelProcesso): boolean => papel === 'api' || papel === 'tudo';

/**
 * Em produção, quem consome a fila precisa de ALERTA_EMAIL (sem ele uma tarefa que falha de vez some sem aviso).
 * Chamado no boot de `worker` e `tudo`; lançar aqui derruba a subida.
 */
export function exigirAlerta(config: Config, papel: PapelProcesso): void {
  if (!consomeFila(papel) || config.ALERTA_EMAIL !== undefined) return;
  if (config.NODE_ENV_DECLARADO === 'development' || config.NODE_ENV_DECLARADO === 'test') return;
  throw new Error('ALERTA_EMAIL é obrigatória em produção para quem consome a fila (ROLE=worker ou tudo): sem ela uma falha definitiva passaria sem aviso.');
}
