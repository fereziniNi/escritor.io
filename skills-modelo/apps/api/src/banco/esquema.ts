// Tabelas do Drizzle. Cada skill que cria tabela acrescenta aqui (ou num arquivo importado aqui) e gera a migração
// com `pnpm --filter api db:generate`. Nunca editar o SQL gerado em drizzle/ à mão.
export * from '../usuarios/usuario.tabela';
export * from '../auth/auth.tabelas';
