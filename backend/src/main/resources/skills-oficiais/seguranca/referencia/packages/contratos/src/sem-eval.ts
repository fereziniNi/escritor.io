// origem: skills-modelo/packages/contratos/src/sem-eval.ts
// CSP sem 'unsafe-eval' (skill seguranca): o zod não tenta compilar validadores com Function(), que o navegador
// bloqueia e registra como violação da CSP em toda tela. A validação continua igual, só sem o atalho compilado.
// O zod decide isso ao criar o primeiro esquema de objeto: este arquivo é o PRIMEIRO import do index.ts.
import { z } from 'zod';

z.config({ jitless: true });
