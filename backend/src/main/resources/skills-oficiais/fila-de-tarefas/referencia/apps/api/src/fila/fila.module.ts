// origem: skills-modelo/apps/api/src/fila/fila.module.ts
import { Global, Inject, Injectable, Logger, Module, type BeforeApplicationShutdown, type OnApplicationBootstrap, type OnModuleInit } from '@nestjs/common';
import { BANCO, type Db } from '../banco/banco';
import { type Config } from '../config/config';
import { CONFIG } from '../config/config.module';
import { EmailModule } from '../email/email.module';
import { executarRetencao } from '../lgpd/retencao';
import { AlertaFalhaPorEmail } from './alerta-falha';
import { NOME_LGPD_RETENCAO, NOME_LIMPAR_CHAVES } from './catalogo';
import { Fila, ehErroDeConexao } from './fila';
import { exigirAlerta, resolverPapel } from './papel';
import { prepararFila } from './preparar-fila';

/**
 * Cria a `Fila` conforme `ROLE`. Em desenvolvimento/teste (NODE_ENV declarado) ela cria o schema sozinha com o DONO do banco
 * (DATABASE_URL); em produção o schema vem do passo de migração e o runtime nunca faz DDL.
 */
export function criarFila(config: Config): Fila {
  const papel = resolverPapel(config);
  if (papel === 'migrar') throw new Error('ROLE=migrar não sobe a aplicação: ela só prepara o banco e a fila (main.ts)');
  exigirAlerta(config, papel);
  const logger = new Logger('Fila');
  const emDev = config.NODE_ENV_DECLARADO === 'development' || config.NODE_ENV_DECLARADO === 'test';
  return new Fila({
    url: (config.DATABASE_URL_RUNTIME ?? config.DATABASE_URL).revelar(),
    papel,
    encerrarTimeoutMs: config.FILA_ENCERRAR_TIMEOUT_S * 1000,
    antesDeIniciar: emDev ? (tarefas) => prepararFila(config.DATABASE_URL.revelar(), { tarefas, conceder: true }) : undefined,
    log: { info: (m: string) => logger.log(m), warn: (m: string) => logger.warn(m), error: (m: string) => logger.error(m) },
  });
}

/** Segundos entre tentativas de iniciar a fila enquanto o banco está inalcançável. */
const ESPERA_RECONEXAO_MS = 5_000;

/**
 * Liga a fila ao ciclo de vida: inicia depois de todos registrarem suas tarefas; no SIGTERM termina o que está em andamento.
 * Banco inalcançável no boot NÃO derruba a aplicação (o /api/health mostra o banco fora do ar): a fila tenta de novo a cada
 * 5 s e, enquanto isso, `ServicoEmail.disparar` usa o envio direto. Schema ausente ou sem permissão derruba (configuração errada).
 */
@Injectable()
class CicloDaFila implements OnApplicationBootstrap, BeforeApplicationShutdown {
  private readonly logger = new Logger('Fila');
  private religar: NodeJS.Timeout | undefined;
  private desligando = false;

  constructor(private readonly fila: Fila) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.tentar();
  }

  private async tentar(): Promise<void> {
    try {
      await this.fila.iniciar();
    } catch (e) {
      if (!ehErroDeConexao(e)) throw e;
      this.logger.error(`banco inalcançável; a fila tenta de novo em ${ESPERA_RECONEXAO_MS / 1000} s (${(e as Error).message})`);
      if (this.desligando) return;
      this.religar = setTimeout(() => void this.tentar().catch((e2: unknown) => this.logger.error(`fila não iniciou: ${(e2 as Error).message}`)), ESPERA_RECONEXAO_MS);
      this.religar.unref();
    }
  }

  /** Antes de fechar o servidor HTTP e o pool do banco: as tarefas em andamento ainda precisam dos dois. */
  async beforeApplicationShutdown(): Promise<void> {
    this.desligando = true;
    clearTimeout(this.religar);
    await this.fila.encerrar();
  }
}

/** Tarefas do próprio sistema: retenção da LGPD (diária, 03:00 de Brasília) e limpeza das chaves de idempotência (04:00). */
@Injectable()
class TarefasDoSistema implements OnModuleInit {
  constructor(
    private readonly fila: Fila,
    @Inject(BANCO) private readonly db: Db,
    @Inject(CONFIG) private readonly config: Config,
  ) {}

  onModuleInit(): void {
    this.fila.registrarTarefa(
      NOME_LGPD_RETENCAO,
      async () => {
        await executarRetencao({ db: this.db, config: this.config });
      },
      { tentativas: 3, backoff: true },
    );
    this.fila.agendar(NOME_LGPD_RETENCAO, '0 3 * * *', { tz: 'America/Sao_Paulo' });
    this.fila.registrarTarefa(
      NOME_LIMPAR_CHAVES,
      async () => {
        await this.fila.limparChaves(30);
      },
      { tentativas: 3 },
    );
    this.fila.agendar(NOME_LIMPAR_CHAVES, '0 4 * * *', { tz: 'America/Sao_Paulo' });
  }
}

@Global()
@Module({
  imports: [EmailModule],
  providers: [{ provide: Fila, inject: [CONFIG], useFactory: criarFila }, CicloDaFila, TarefasDoSistema, AlertaFalhaPorEmail],
  exports: [Fila],
})
export class FilaModule {}
