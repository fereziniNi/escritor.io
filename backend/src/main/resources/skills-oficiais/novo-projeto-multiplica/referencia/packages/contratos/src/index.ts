// origem: skills-modelo/packages/contratos/src/index.ts
// Contratos compartilhados entre a API (apps/api) e a web (apps/web): esquemas zod e os tipos inferidos deles.
// Regra: a API valida a resposta que monta com o mesmo esquema que a web usa para ler.
export * from './saude.js';
