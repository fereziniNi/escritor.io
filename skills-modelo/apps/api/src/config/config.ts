import { z } from 'zod';
import { Segredo, lerSegredo } from './segredo';

/** Só caracteres de tag/sha (letras, números, . _ + -): um valor estranho no ambiente não vai para o /api/health. */
const IDENTIFICADOR_DE_BUILD = /^[A-Za-z0-9._+-]{1,64}$/;

const obrigatoria = { error: (issue: { input: unknown }) => (issue.input === undefined ? 'obrigatória' : 'valor inválido') };

/**
 * Schema de TODAS as variáveis de ambiente da API. Regras:
 * - variável nova entra aqui E nos dois .env.example (test/env-documentadas.spec.ts confere);
 * - segredo (senha, chave, URL com senha) vira `Segredo` com `.transform((v) => new Segredo(v))`;
 * - toda variável também pode vir de arquivo: `NOME_ARQUIVO=/run/secrets/nome` (ver segredo.ts).
 */
export const esquemaConfig = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  /** postgres://usuario:senha@host:5432/banco — tem senha, então é Segredo. */
  DATABASE_URL: z
    .string(obrigatoria)
    .regex(/^postgres(ql)?:\/\/\S+$/, 'deve ser uma URL postgres:// ou postgresql://')
    .transform((v) => new Segredo(v)),
  /** Versão e commit gravados no build da imagem (build-args); aparecem no /api/health. */
  APP_VERSAO: z.string().regex(IDENTIFICADOR_DE_BUILD, 'só letras, números e . _ + -').default('dev'),
  APP_COMMIT: z.string().regex(IDENTIFICADOR_DE_BUILD, 'só letras, números e . _ + -').default('desconhecido'),
  /** Pasta do build da web (apps/web/dist). Definida: a API serve o SPA. Vazia: só a API (dev usa o Vite). */
  WEB_DIST: z.string().min(1).optional(),
});

export type Config = Readonly<z.infer<typeof esquemaConfig>>;

/** Configuração inválida: `problemas` lista cada variável com o motivo, nunca o valor recebido. */
export class ErroConfiguracao extends Error {
  constructor(readonly problemas: readonly string[]) {
    super(`Configuração inválida:\n${problemas.map((p) => `  - ${p}`).join('\n')}`);
    this.name = 'ErroConfiguracao';
  }
}

/**
 * Valida o ambiente e devolve a configuração tipada e congelada. Falha rápida no boot: lança ErroConfiguracao com
 * TODAS as variáveis inválidas de uma vez. String vazia vale como ausente.
 */
export function carregarConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const entrada: Record<string, string | undefined> = {};
  const problemas: string[] = [];
  const ilegiveis = new Set<string>();
  for (const nome of Object.keys(esquemaConfig.shape)) {
    try {
      const valor = lerSegredo(env, nome);
      entrada[nome] = valor === '' ? undefined : valor;
    } catch (e) {
      ilegiveis.add(nome);
      problemas.push((e as Error).message);
    }
  }
  const resultado = esquemaConfig.safeParse(entrada);
  if (!resultado.success) {
    for (const i of resultado.error.issues) {
      const nome = i.path.join('.') || '(ambiente)';
      if (!ilegiveis.has(nome)) problemas.push(`${nome}: ${i.message}`);
    }
  }
  if (problemas.length > 0 || !resultado.success) throw new ErroConfiguracao(problemas);
  return Object.freeze(resultado.data);
}
