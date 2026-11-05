// origem: skills-modelo/estagios/usuarios-e-papeis/packages/contratos/src/index.ts
// Contratos compartilhados entre a API (apps/api) e a web (apps/web): esquemas zod e os tipos inferidos deles.
// Regra: a API valida a resposta que monta com o mesmo esquema que a web usa para ler.
// sem-eval.js tem de continuar o primeiro import (antes de qualquer esquema): CSP sem 'unsafe-eval'.
import './sem-eval.js';

export * from './saude.js';
export * from './usuarios.js';
