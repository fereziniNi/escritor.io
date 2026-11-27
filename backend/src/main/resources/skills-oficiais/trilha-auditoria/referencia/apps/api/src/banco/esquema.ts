// origem: skills-modelo/estagios/trilha-auditoria/apps/api/src/banco/esquema.ts
// Tabelas do Drizzle. Cada skill que cria tabela acrescenta aqui (ou num arquivo importado aqui) e gera a migração
// com `pnpm --filter api db:generate`. Nunca editar o SQL gerado em drizzle/ à mão.
export * from '../usuarios/usuario.tabela';
export * from '../auth/auth.tabelas';
export * from '../auditoria/evento-auditoria.tabela';
