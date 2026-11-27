// origem: skills-modelo/apps/api/src/fila/catalogo.ts
import { type Queue } from 'pg-boss';

/**
 * Filas do sistema. CADA tarefa nova entra aqui: criar uma fila é DDL (cria tabelas no schema `fila`), e a API roda com o
 * papel de runtime, que não pode. O passo de migração (ROLE=migrar ou `pnpm --filter api fila:migrar`, com o DONO do banco)
 * cria todas as filas deste catálogo. Em desenvolvimento a aplicação faz isso sozinha ao subir.
 *
 * Nomes: letras minúsculas, números e hífen. Opções de fila (retenção): `deleteAfterSeconds` apaga a tarefa concluída ou
 * falha depois desse tempo (o payload some junto), então use o MENOR prazo que ainda deixa investigar um problema;
 * `retentionSeconds` apaga a que ficou esperando (padrão do pg-boss: 14 dias). Payload com segredo ou código (OTP): os dois
 * prazos no máximo a validade do segredo. `expireInSeconds` é o prazo de uma execução (padrão 15 min).
 */
export const NOME_EMAIL_ENVIAR = 'email-enviar';
export const NOME_LGPD_RETENCAO = 'lgpd-retencao';
export const NOME_LIMPAR_CHAVES = 'fila-limpar-chaves';

export const FILAS_DO_SISTEMA: Readonly<Record<string, Omit<Queue, 'name'>>> = {
  // O payload é o e-mail inteiro (endereço e corpo RENDERIZADO, com o código de login): segredo não fica no banco além da
  // validade dele (10 min). Esperando: some em 10 min (retentionSeconds; worker parado mais que isso = e-mail perdido, o código
  // já teria vencido). Concluído ou falho: some em 5 min (deleteAfterSeconds). A limpeza roda a cada minuto (fila.ts).
  [NOME_EMAIL_ENVIAR]: { retentionSeconds: 600, deleteAfterSeconds: 300, expireInSeconds: 120 },
  [NOME_LGPD_RETENCAO]: { deleteAfterSeconds: 7 * 24 * 3600, expireInSeconds: 1800 },
  [NOME_LIMPAR_CHAVES]: { deleteAfterSeconds: 24 * 3600 },
};
