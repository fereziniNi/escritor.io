import PgBoss from 'pg-boss';
import { SCHEMA_FILA } from './preparar-fila';
import { type PapelFila, consomeFila } from './papel';

/** Lançar isto no handler = falha definitiva já na 1ª tentativa (endereço inválido, dado que nunca vai passar): alerta e não repete. */
export class ErroSemRetry extends Error {
  readonly semRetry = true;
  constructor(mensagem: string) {
    super(mensagem);
    this.name = 'ErroSemRetry';
  }
}

export interface OpcoesTarefa {
  /** Total de tentativas, a 1ª incluída (padrão 5). */
  tentativas?: number;
  /** Espera crescente entre tentativas (padrão true: 5 s, 10 s, 20 s... até 10 min). false = sempre a mesma espera. */
  backoff?: boolean;
}

export interface ContextoTarefa {
  jobId: string;
  /** 1 na primeira execução. */
  tentativa: number;
}

export type Handler<T> = (dados: T, contexto: ContextoTarefa) => Promise<void>;

/** O que o alerta recebe. NUNCA o payload da tarefa (pode ter dado pessoal) nem a mensagem do erro. */
export interface FalhaDefinitiva {
  tarefa: string;
  jobId: string;
  tentativas: number;
  /** Nome da classe do erro (ex.: `Error`, `ErroSemRetry`). */
  tipoErro: string;
}

export interface OpcoesFila {
  /** Conexão do runtime (DATABASE_URL_RUNTIME ?? DATABASE_URL). O pg-boss só faz DML por ela. */
  url: string;
  papel: PapelFila;
  /** Intervalo de busca de tarefas, em segundos (padrão 2; mínimo 0,5). */
  intervaloSegundos?: number;
  /** Espera base entre tentativas, em segundos (padrão 5). Testes usam 1. */
  atrasoRetrySegundos?: number;
  /** Prazo do encerramento gracioso (padrão 30 s). */
  encerrarTimeoutMs?: number;
  /** Conexões do pool do pg-boss (padrão 4). */
  poolMax?: number;
  /** Roda antes de conectar, com os nomes das tarefas registradas. Em desenvolvimento o módulo usa para criar o schema. */
  antesDeIniciar?: (tarefas: readonly string[]) => Promise<void>;
  log?: Pick<Console, 'info' | 'warn' | 'error'>;
}

interface Definicao {
  nome: string;
  handler: Handler<never>;
  tentativas: number;
  backoff: boolean;
}

interface Agenda {
  nome: string;
  cron: string;
  tz: string;
  dados: object;
}

/** Corpo gravado no job: `chave` (idempotência) fica fora de `dados`. */
interface Envelope {
  chave?: string;
  dados: unknown;
}

/** Prazo padrão de um job ativo do pg-boss: depois dele o job é dado como perdido e repetido. A reserva de chave vale o mesmo. */
const EXPIRA_RESERVA_S = 900;

/**
 * Fila de tarefas sobre o MESMO Postgres (pg-boss, schema `fila`): sobrevive a reinício, repete com backoff e entrega
 * "pelo menos uma vez" (por isso o handler tem de aguentar rodar duas vezes: use `chave`). Ciclo: `registrarTarefa` e
 * `agendar` antes de `iniciar`; depois `enviar`; `encerrar` no desligamento. Sem Nest: o módulo (fila.module.ts) só liga isto
 * ao ciclo de vida da aplicação.
 */
export class Fila {
  private readonly definicoes = new Map<string, Definicao>();
  private readonly agendas: Agenda[] = [];
  private readonly pendentes = new Set<Promise<unknown>>();
  private boss: PgBoss | undefined;
  private alerta: ((falha: FalhaDefinitiva) => Promise<void>) | undefined;
  private encerrando = false;
  private readonly log: Pick<Console, 'info' | 'warn' | 'error'>;

  constructor(private readonly opcoes: OpcoesFila) {
    this.log = opcoes.log ?? console;
  }

  /** Registra a tarefa e o que fazer com ela. Em `api` o handler fica guardado, mas só `worker` e `tudo` o executam. */
  registrarTarefa<T = unknown>(nome: string, handler: Handler<T>, opcoes: OpcoesTarefa = {}): void {
    if (this.boss !== undefined) throw new Error(`registrarTarefa('${nome}') depois de iniciar(): registre antes`);
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(nome)) throw new Error(`nome de tarefa inválido: '${nome}' (minúsculas, números e hífen)`);
    if (this.definicoes.has(nome)) throw new Error(`tarefa já registrada: '${nome}'`);
    const { tentativas = 5, backoff = true } = opcoes;
    if (!Number.isInteger(tentativas) || tentativas < 1 || tentativas > 50) throw new Error('tentativas deve ser um inteiro de 1 a 50');
    this.definicoes.set(nome, { nome, handler: handler, tentativas, backoff });
  }

  /** Rotina por cron (5 campos), no fuso informado (padrão America/Sao_Paulo). Gravada por quem consome a fila; repetir é seguro. */
  agendar(nome: string, cron: string, opcoes: { tz?: string; dados?: object } = {}): void {
    if (this.boss !== undefined) throw new Error(`agendar('${nome}') depois de iniciar(): agende antes`);
    this.agendas.push({ nome, cron, tz: opcoes.tz ?? 'America/Sao_Paulo', dados: opcoes.dados ?? {} });
  }

  /** Quem é avisado quando uma tarefa falha de vez. Uma função só; erro dentro dela é registrado e engolido. */
  definirAlerta(alerta: (falha: FalhaDefinitiva) => Promise<void>): void {
    this.alerta = alerta;
  }

  async iniciar(): Promise<void> {
    if (this.boss !== undefined) return;
    await this.opcoes.antesDeIniciar?.([...this.definicoes.keys()]);
    const consome = consomeFila(this.opcoes.papel);
    const boss = new PgBoss({
      connectionString: this.opcoes.url,
      schema: SCHEMA_FILA,
      max: this.opcoes.poolMax ?? 4,
      application_name: `fila-${this.opcoes.papel}`,
      // O runtime não tem DDL: o schema vem do passo de migração (preparar-fila.ts).
      migrate: false,
      // Manutenção (expirar, apagar antigas) e cron só onde há consumo; a API apenas enfileira.
      supervise: consome,
      schedule: consome,
    });
    boss.on('error', (e: Error) => this.log.error(`[fila] erro do pg-boss: ${e.message}`));
    try {
      await boss.start();
    } catch (e) {
      await boss.stop({ graceful: false, wait: true }).catch(() => {});
      const msg = (e as Error).message;
      if (/not installed|does not exist|schema|permission denied/i.test(msg)) {
        throw new Error(`fila: schema '${SCHEMA_FILA}' ausente ou sem permissão (${msg}). Rode o passo de migração (ROLE=migrar ou "pnpm --filter api fila:migrar") com o dono do banco.`, { cause: e });
      }
      throw e;
    }
    this.boss = boss;
    if (!consome) return;
    for (const d of this.definicoes.values()) {
      await boss.work<Envelope>(d.nome, { includeMetadata: true, batchSize: 1, pollingIntervalSeconds: this.opcoes.intervaloSegundos ?? 2 }, async (jobs) => {
        for (const job of jobs) await this.executar(d, job);
      });
    }
    for (const a of this.agendas) {
      const d = this.definicoes.get(a.nome);
      if (d === undefined) throw new Error(`agendar('${a.nome}'): tarefa não registrada`);
      await boss.schedule(a.nome, a.cron, { dados: a.dados } satisfies Envelope, { tz: a.tz, ...this.opcoesEnvio(d) });
    }
  }

  /**
   * Enfileira. Com `chave`, a tarefa produz no máximo UM efeito mesmo enviada várias vezes ou repetida pela fila: o handler só
   * roda se a chave ainda não foi concluída (guardada 30 dias). `atrasoSegundos` adia a 1ª execução. Devolve o id do job.
   */
  async enviar<T extends object>(nome: string, dados: T, opcoes: { chave?: string; atrasoSegundos?: number } = {}): Promise<string> {
    const boss = this.boss;
    const d = this.definicoes.get(nome);
    if (boss === undefined) throw new Error('fila não iniciada');
    if (d === undefined) throw new Error(`tarefa não registrada: '${nome}'`);
    const envio = (async () => {
      const id = await boss.send(nome, { chave: opcoes.chave, dados } satisfies Envelope, {
        ...this.opcoesEnvio(d),
        ...(opcoes.atrasoSegundos === undefined ? {} : { startAfter: opcoes.atrasoSegundos }),
      });
      if (id === null) throw new Error(`a fila recusou a tarefa '${nome}'`);
      return id;
    })();
    this.pendentes.add(envio);
    try {
      return await envio;
    } finally {
      this.pendentes.delete(envio);
    }
  }

  /**
   * Desligamento: espera os envios em curso, para de buscar tarefas e deixa as em andamento terminarem, até
   * `encerrarTimeoutMs`. O que passar do prazo volta para a fila (a fila repete quando o job expira).
   */
  async encerrar(): Promise<void> {
    const boss = this.boss;
    if (boss === undefined || this.encerrando) return;
    this.encerrando = true;
    await Promise.allSettled([...this.pendentes]);
    const prazo = this.opcoes.encerrarTimeoutMs ?? 30_000;
    let temporizador: NodeJS.Timeout | undefined;
    const estourou = new Promise<'prazo'>((resolve) => {
      temporizador = setTimeout(() => resolve('prazo'), prazo + 500);
    });
    const parou = boss.stop({ graceful: true, wait: true, timeout: prazo }).then(() => 'parou' as const);
    try {
      if ((await Promise.race([parou, estourou])) === 'prazo') {
        this.log.warn(`[fila] encerramento passou de ${prazo} ms: tarefas em andamento serão repetidas pela fila`);
        await boss.stop({ graceful: false, wait: false }).catch(() => {});
      }
    } finally {
      clearTimeout(temporizador);
      this.boss = undefined;
    }
  }

  private opcoesEnvio(d: Definicao): PgBoss.SendOptions {
    const base = this.opcoes.atrasoRetrySegundos ?? 5;
    return { retryLimit: d.tentativas - 1, retryDelay: base, retryBackoff: d.backoff, ...(d.backoff ? { retryDelayMax: 600 } : {}) };
  }

  /** Uma execução: respeita a chave de idempotência, decide se a falha é definitiva e avisa. */
  private async executar(d: Definicao, job: PgBoss.JobWithMetadata<Envelope>): Promise<void> {
    const contexto: ContextoTarefa = { jobId: job.id, tentativa: job.retryCount + 1 };
    const { chave, dados } = job.data;
    try {
      if (chave === undefined || chave === null) await d.handler(dados as never, contexto);
      else await this.umaVez(`${d.nome}:${chave}`, () => d.handler(dados as never, contexto));
    } catch (e) {
      const erro = e instanceof Error ? e : new Error(String(e));
      const semRetry = erro instanceof ErroSemRetry;
      const definitiva = semRetry || job.retryCount >= job.retryLimit;
      this.log.error(`[fila] tarefa '${d.nome}' (${job.id}) falhou na tentativa ${contexto.tentativa}/${d.tentativas}: ${erro.message}`);
      if (definitiva) await this.avisar({ tarefa: d.nome, jobId: job.id, tentativas: contexto.tentativa, tipoErro: erro.name });
      // Sem retry: conclui o job (o alerta já saiu); com retry, relança e o pg-boss agenda a próxima tentativa.
      if (!semRetry) throw erro;
    }
  }

  private async avisar(falha: FalhaDefinitiva): Promise<void> {
    if (this.alerta === undefined) return;
    try {
      await this.alerta(falha);
    } catch (e) {
      this.log.error(`[fila] o alerta de falha da tarefa '${falha.tarefa}' também falhou: ${(e as Error).message}`);
    }
  }

  /**
   * Reserva a chave, roda e marca como concluída. Falha libera a chave (a próxima tentativa roda). Chave já concluída (ou
   * reservada por uma execução ainda viva) = não roda de novo. Se o processo morrer no meio, a reserva vence em 15 min
   * (o mesmo prazo do job) e a repetição roda: "pelo menos uma vez".
   */
  private async umaVez(chave: string, executar: () => Promise<void>): Promise<void> {
    const db = this.boss!.getDb();
    const t = `${SCHEMA_FILA}.efeito_unico`;
    const r = await db.executeSql(
      `INSERT INTO ${t} (chave) VALUES ($1)
       ON CONFLICT (chave) DO UPDATE SET iniciado_em = now()
       WHERE ${t}.concluido_em IS NULL AND ${t}.iniciado_em < now() - make_interval(secs => $2)
       RETURNING chave`,
      [chave, EXPIRA_RESERVA_S],
    );
    if (r.rows.length === 0) {
      this.log.info(`[fila] chave '${chave}' já executada: nada a fazer`);
      return;
    }
    try {
      await executar();
    } catch (e) {
      await db.executeSql(`DELETE FROM ${t} WHERE chave = $1 AND concluido_em IS NULL`, [chave]);
      throw e;
    }
    await db.executeSql(`UPDATE ${t} SET concluido_em = now() WHERE chave = $1`, [chave]);
  }

  /** Apaga as chaves concluídas há mais de `dias` dias (tarefa do sistema `fila-limpar-chaves`). */
  async limparChaves(dias = 30): Promise<number> {
    const r = await this.boss!.getDb().executeSql(
      `DELETE FROM ${SCHEMA_FILA}.efeito_unico WHERE concluido_em < now() - make_interval(days => $1) RETURNING chave`,
      [dias],
    );
    return r.rows.length;
  }
}

const CODIGOS_DE_CONEXAO = new Set(['ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT', 'ECONNRESET', 'EAI_AGAIN', '57P03', '08006', '08001', '08004']);

/** O banco não está alcançável agora (fora do ar, subindo, rede). Diferente de schema ausente ou sem permissão, que é configuração errada. */
export function ehErroDeConexao(e: unknown): boolean {
  if (e instanceof AggregateError) return e.errors.length > 0 && e.errors.every(ehErroDeConexao);
  const codigo = (e as { code?: unknown } | null)?.code;
  return typeof codigo === 'string' && CODIGOS_DE_CONEXAO.has(codigo);
}
