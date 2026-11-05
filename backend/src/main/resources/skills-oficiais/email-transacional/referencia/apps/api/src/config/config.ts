// origem: skills-modelo/estagios/email-transacional/apps/api/src/config/config.ts
import { z } from 'zod';
import { Segredo, lerSegredo } from './segredo';

/** Só caracteres de tag/sha (letras, números, . _ + -): um valor estranho no ambiente não vai para o /api/health. */
const IDENTIFICADOR_DE_BUILD = /^[A-Za-z0-9._+-]{1,64}$/;

/** Origem web: https + host (+ porta), sem caminho nem curinga; http só para localhost e 127.0.0.1 (dev). */
const ORIGEM = /^(https:\/\/[A-Za-z0-9.-]+|http:\/\/(localhost|127\.0\.0\.1))(:\d{1,5})?$/;

const obrigatoria = { error: (issue: { input: unknown }) => (issue.input === undefined ? 'obrigatória' : 'valor inválido') };

/**
 * Schema de TODAS as variáveis de ambiente da API. Regras:
 * - variável nova entra aqui E nos dois .env.example (test/env-documentadas.spec.ts confere);
 * - segredo (senha, chave, URL com senha) vira `Segredo` com `.transform((v) => new Segredo(v))`;
 * - toda variável também pode vir de arquivo: `NOME_ARQUIVO=/run/secrets/nome` (ver segredo.ts).
 */
const esquemaBase = z.object({
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
  /**
   * Segurança (src/seguranca/). CORS_ORIGENS: origens de OUTROS sites que podem chamar a API com cookie, separadas por
   * vírgula (`https://painel.exemplo.com.br`). Vazia (padrão): CORS desligado, front e API no mesmo endereço.
   */
  CORS_ORIGENS: z
    .string()
    .default('')
    .transform((v) => v.split(',').map((o) => o.trim()).filter(Boolean))
    .pipe(z.array(z.string().regex(ORIGEM, 'cada item deve ser uma origem https sem caminho (http só localhost), ex.: https://painel.exemplo.com.br'))),
  /** Requisições por minuto por IP em /api (janela fixa, por instância). Acima disso: 429 com Retry-After. */
  LIMITE_REQ_POR_IP: z.coerce.number().int().min(1).default(300),
  /** Quantos proxies confiáveis estão na frente da API (Caddy = 1). Define o IP real, o https e o host vistos. */
  PROXIES_CONFIAVEIS: z.coerce.number().int().min(0).max(10).default(0),
  /**
   * E-mail (src/email/). `smtp` envia de verdade; `log` só registra o envio (desenvolvimento e testes) e é RECUSADO em
   * produção. O padrão é `log`, então produção precisa declarar `MAIL_MODE=smtp` e o servidor.
   */
  MAIL_MODE: z.enum(['smtp', 'log']).default('log'),
  SMTP_HOST: z.string().min(1).optional(),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(587),
  /** true = TLS direto (porta 465); false = STARTTLS quando o servidor oferece (587, 25 e o Mailpit de dev). */
  SMTP_SEGURO: z
    .enum(['true', 'false'], { error: 'deve ser true ou false' })
    .default('false')
    .transform((v) => v === 'true'),
  SMTP_USUARIO: z.string().min(1).optional(),
  /** Senha do SMTP: Segredo (em produção use SMTP_SENHA_ARQUIVO). */
  SMTP_SENHA: z
    .string()
    .min(1)
    .transform((v) => new Segredo(v))
    .optional(),
  /** Remetente: `Sistema <nao-responda@exemplo.com.br>` ou só o endereço. Sem quebra de linha (injeção de cabeçalho). */
  EMAIL_REMETENTE: z
    .string()
    .regex(/^[^\r\n<>]*<?[^\s@<>]+@[^\s@<>]+>?$/,'deve ser um endereço ou "Nome <endereco@dominio>", numa linha só')
    .optional(),
});

/** Regras entre variáveis: log nunca em produção; smtp exige servidor e remetente; usuário e senha andam juntos. */
export const esquemaConfig = esquemaBase.superRefine((c, ctx) => {
  const problema = (path: string, message: string) => ctx.addIssue({ code: 'custom', path: [path], message });
  if (c.MAIL_MODE === 'log' && c.NODE_ENV === 'production') {
    problema('MAIL_MODE', 'log não é aceito em produção (nenhum e-mail seria enviado); use MAIL_MODE=smtp');
  }
  if (c.MAIL_MODE === 'smtp') {
    if (c.SMTP_HOST === undefined) problema('SMTP_HOST', 'obrigatória com MAIL_MODE=smtp');
    if (c.EMAIL_REMETENTE === undefined) problema('EMAIL_REMETENTE', 'obrigatória com MAIL_MODE=smtp');
    if (c.SMTP_PORT === 465 && !c.SMTP_SEGURO) problema('SMTP_SEGURO', 'a porta 465 usa TLS direto: defina SMTP_SEGURO=true (com false a conexão trava)');
    if (c.NODE_ENV === 'production' && c.SMTP_PORT === 25 && !c.SMTP_SEGURO) {
      problema('SMTP_PORT', 'a porta 25 sem TLS não é aceita em produção; use 587 (STARTTLS) ou 465 com SMTP_SEGURO=true');
    }
  }
  if (c.SMTP_USUARIO !== undefined && c.SMTP_SENHA === undefined) problema('SMTP_SENHA', 'obrigatória quando SMTP_USUARIO está definido');
  if (c.SMTP_SENHA !== undefined && c.SMTP_USUARIO === undefined) problema('SMTP_USUARIO', 'obrigatória quando SMTP_SENHA está definida');
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
