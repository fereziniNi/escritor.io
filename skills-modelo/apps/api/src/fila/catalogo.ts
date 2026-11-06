import { type Queue } from 'pg-boss';

/**
 * Filas do sistema. CADA tarefa nova entra aqui: criar uma fila é DDL (cria tabelas no schema `fila`), e a API roda com o
 * papel de runtime, que não pode. O passo de migração (ROLE=migrar ou `pnpm --filter api fila:migrar`, com o DONO do banco)
 * cria todas as filas deste catálogo. Em desenvolvimento a aplicação faz isso sozinha ao subir.
 *
 * Nomes: letras minúsculas, números e hífen. Opções de fila (retenção): `deleteAfterSeconds` apaga a tarefa concluída ou
 * falha depois desse tempo (o payload some junto), então use o MENOR prazo que ainda deixa investigar um problema.
 */
export const NOME_EMAIL_ENVIAR = 'email-enviar';
export const NOME_LGPD_RETENCAO = 'lgpd-retencao';
export const NOME_LIMPAR_CHAVES = 'fila-limpar-chaves';

export const FILAS_DO_SISTEMA: Readonly<Record<string, Omit<Queue, 'name'>>> = {
  // O payload é o e-mail inteiro (endereço e corpo): 1 dia, o suficiente para olhar uma falha e reenviar.
  [NOME_EMAIL_ENVIAR]: { deleteAfterSeconds: 24 * 3600, expireInSeconds: 120 },
  [NOME_LGPD_RETENCAO]: { deleteAfterSeconds: 7 * 24 * 3600, expireInSeconds: 1800 },
  [NOME_LIMPAR_CHAVES]: { deleteAfterSeconds: 24 * 3600 },
};
