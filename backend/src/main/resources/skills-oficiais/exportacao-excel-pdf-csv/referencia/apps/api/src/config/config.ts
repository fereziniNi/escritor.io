// origem: skills-modelo/apps/api/src/config/config.ts
import { z } from 'zod';
import { conferirChavesDistintas, lerChaveIndice, lerChavesDados } from '../lgpd/chaveiro';
import { Segredo, lerSegredo } from './segredo';

/** Só caracteres de tag/sha (letras, números, . _ + -): um valor estranho no ambiente não vai para o /api/health. */
const IDENTIFICADOR_DE_BUILD = /^[A-Za-z0-9._+-]{1,64}$/;

/** Origem web: https + host (+ porta), sem caminho nem curinga; http só para localhost e 127.0.0.1 (dev). */
const ORIGEM = /^(https:\/\/[A-Za-z0-9.-]+|http:\/\/(localhost|127\.0\.0\.1))(:\d{1,5})?$/;

/** Domínio de e-mail: rótulos de letras, números e hífen separados por ponto (ao menos um ponto). */
const DOMINIO = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/;

/** Usuário de uma URL postgres (decodificado); texto vazio se não der para ler. */
const usuarioDaUrl = (url: string): string => {
  try {
    return decodeURIComponent(new URL(url).username);
  } catch {
    return '';
  }
};

const obrigatoria ={ error: (issue: { input: unknown }) => (issue.input === undefined ? 'obrigatória' : 'valor inválido') };

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
  /**
   * Papel de banco SÓ de runtime (trilha-auditoria): sem UPDATE/DELETE na trilha. Com ela definida, a API conecta por aqui e
   * DATABASE_URL (o dono do esquema) fica só para as migrações. Opcional só com NODE_ENV=development/test declarado: fora
   * disso a API não sobe sem ela (auditoria/papel-runtime.ts) e o usuário dela tem de ser outro que o de DATABASE_URL.
   */
  DATABASE_URL_RUNTIME: z
    .string()
    .regex(/^postgres(ql)?:\/\/\S+$/, 'deve ser uma URL postgres:// ou postgresql://')
    .transform((v) => new Segredo(v))
    .optional(),
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
  /**
   * Usuários (src/usuarios/). ADMIN_INICIAL_EMAIL: se não existir nenhum ADMIN ativo, a API cria (ou reativa) este
   * usuário como ADMIN ao subir. Guardado em minúsculas e sem espaços. NOME_SISTEMA: nome que aparece nos e-mails
   * (convite). Uma linha só.
   */
  ADMIN_INICIAL_EMAIL: z.string().trim().toLowerCase().pipe(z.email().max(254)).optional(),
  NOME_SISTEMA: z.string().regex(/^[^\r\n]{1,80}$/, 'uma linha de até 80 caracteres').default('Sistema'),
  /**
   * Login por código (src/auth/). AUTH_DOMINIOS_PERMITIDOS: domínios de e-mail que podem pedir código, separados por
   * vírgula, comparados exatamente (vazia: qualquer domínio; quem decide é a tabela usuario). AUTH_SEGREDO_CODIGO: chave
   * do HMAC dos códigos (Segredo, mínimo 32 caracteres; obrigatória em produção, a API não sobe sem ela).
   * Sessão: expira parada AUTH_SESSAO_OCIOSA_MIN minutos ou AUTH_SESSAO_ABSOLUTA_H horas depois do login.
   */
  AUTH_DOMINIOS_PERMITIDOS: z
    .string()
    .default('')
    .transform((v) => v.split(',').map((d) => d.trim().toLowerCase()).filter(Boolean))
    .pipe(z.array(z.string().regex(DOMINIO, 'cada item deve ser um domínio sem @ nem curinga, ex.: grupomultiplica.com.br'))),
  AUTH_SEGREDO_CODIGO: z
    .string()
    .min(32, 'mínimo 32 caracteres (gere com: openssl rand -hex 32)')
    .transform((v) => new Segredo(v))
    .optional(),
  AUTH_SESSAO_OCIOSA_MIN: z.coerce.number().int().min(1).max(1440).default(30),
  AUTH_SESSAO_ABSOLUTA_H: z.coerce.number().int().min(1).max(720).default(12),
  /**
   * Dados pessoais (src/lgpd/). DADOS_CHAVES: chaves AES-256-GCM da criptografia de campo, `kid:base64` separadas por
   * vírgula (32 bytes cada; a primeira cifra, as outras só decifram). DADOS_CHAVE_INDICE: chave do HMAC do índice cego
   * (32 bytes, diferente das de dados). As duas são Segredo e andam juntas; obrigatórias em produção (lgpd/chaves.ts).
   * RETENCAO_DIAS: dias depois do encerramento até o expurgo (comando lgpd:retencao; vazia = nada é expurgado).
   * RETENCAO_AUDITORIA_IP_DIAS: idade do evento de auditoria cujo IP o mesmo comando apaga, com o DONO do banco (vazia = a trilha fica intacta).
   */
  DADOS_CHAVES: z
    .string()
    .transform((v) => new Segredo(v))
    .optional(),
  DADOS_CHAVE_INDICE: z
    .string()
    .transform((v) => new Segredo(v))
    .optional(),
  RETENCAO_DIAS: z.coerce.number().int().min(1).max(36_500).optional(),
  RETENCAO_AUDITORIA_IP_DIAS: z.coerce.number().int().min(1).max(36_500).optional(),
  /**
   * Exportação (src/exportacao/). EXPORTACAO_MAX_LINHAS: máximo de linhas de um arquivo Excel/CSV (o PDF corta em 2.000);
   * acima disso o arquivo sai cortado e o cabeçalho X-Exportacao-Truncada: true avisa. Excel e CSV saem em fluxo (memória estável); só o PDF fica em memória,
   * por isso o teto (100.000). EXPORTACAO_LOGO: caminho de um PNG ou JPEG (até 512 KB) que o PDF desenha no topo; arquivo
   * ilegível = a API não sobe. Vazia: só o nome do sistema (NOME_SISTEMA).
   */
  EXPORTACAO_MAX_LINHAS: z.coerce.number().int().min(1).max(100_000).default(10_000),
  EXPORTACAO_LOGO: z.string().min(1).optional(),
});

/** Mensagem de um erro de validação de chave (nunca contém o valor da chave). */
const motivo = (f: () => unknown): string | null => {
  try {
    f();
    return null;
  } catch (e) {
    return (e as Error).message;
  }
};

/**
 * Regras entre variáveis: log nunca em produção; smtp exige servidor e remetente; usuário e senha andam juntos; sessão
 * ociosa não maior que a absoluta. (AUTH_SEGREDO_CODIGO em produção é cobrado pelo AuthModule ao subir.)
 */
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
  if (c.DATABASE_URL_RUNTIME !== undefined && usuarioDaUrl(c.DATABASE_URL_RUNTIME.revelar()) === usuarioDaUrl(c.DATABASE_URL.revelar())) {
    problema('DATABASE_URL_RUNTIME', 'não pode usar o mesmo usuário de DATABASE_URL: o dono ignora o REVOKE da auditoria (use o papel app_runtime)');
  }
  if (c.AUTH_SESSAO_OCIOSA_MIN > c.AUTH_SESSAO_ABSOLUTA_H * 60) {
    problema('AUTH_SESSAO_OCIOSA_MIN', 'não pode ser maior que AUTH_SESSAO_ABSOLUTA_H (em minutos)');
  }
  const chaves = c.DADOS_CHAVES?.revelar();
  const indice = c.DADOS_CHAVE_INDICE?.revelar();
  if ((chaves === undefined) !== (indice === undefined)) {
    problema(chaves === undefined ? 'DADOS_CHAVES' : 'DADOS_CHAVE_INDICE', 'DADOS_CHAVES e DADOS_CHAVE_INDICE andam juntas: defina as duas');
  }
  const erroChaves = chaves === undefined ? null : motivo(() => lerChavesDados(chaves));
  const erroIndice = indice === undefined ? null : motivo(() => lerChaveIndice(indice));
  if (erroChaves) problema('DADOS_CHAVES', erroChaves);
  if (erroIndice) problema('DADOS_CHAVE_INDICE', erroIndice);
  if (chaves !== undefined && indice !== undefined && !erroChaves && !erroIndice) {
    const erro = motivo(() => conferirChavesDistintas(lerChavesDados(chaves), lerChaveIndice(indice)));
    if (erro) problema('DADOS_CHAVE_INDICE', erro);
  }
});

export type Config = Readonly<
  z.infer<typeof esquemaConfig> & {
    /**
     * NODE_ENV como veio do ambiente, sem o padrão `development`: undefined quando não foi definido. Regras de segurança
     * que precisam falhar fechado (cookie e segredo do login) só relaxam com `development` ou `test` DECLARADOS.
     */
    NODE_ENV_DECLARADO: 'development' | 'test' | 'production' | undefined;
  }
>;

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
  return Object.freeze({ ...resultado.data, NODE_ENV_DECLARADO: entrada['NODE_ENV'] === undefined ? undefined : resultado.data.NODE_ENV });
}
