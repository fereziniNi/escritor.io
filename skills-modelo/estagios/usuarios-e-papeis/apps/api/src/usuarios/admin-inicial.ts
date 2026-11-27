import { Inject, Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { and, count, eq, sql } from 'drizzle-orm';
import { BANCO, type Db } from '../banco/banco';
import { usuario } from '../banco/esquema';
import { type Config } from '../config/config';
import { CONFIG } from '../config/config.module';
import { mascararEmail } from '../email/enviador-email';

/** Número fixo da trava de aconselhamento do Postgres: duas instâncias subindo juntas não criam o admin duas vezes. */
const TRAVA_ADMIN_INICIAL = 727_001;

/**
 * Primeiro administrador: se `ADMIN_INICIAL_EMAIL` está definido e NÃO existe nenhum ADMIN ativo, cria esse usuário
 * como ADMIN (ou, se o e-mail já existe, reativa e promove). Com um ADMIN ativo no banco não faz nada, então reiniciar
 * a API não recria nem altera ninguém. Quem entra é decidido pelo login (por e-mail); aqui só existe a linha.
 */
@Injectable()
export class AdminInicial implements OnApplicationBootstrap {
  private readonly logger = new Logger('AdminInicial');

  constructor(
    @Inject(BANCO) private readonly db: Db,
    @Inject(CONFIG) private readonly config: Config,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const email = this.config.ADMIN_INICIAL_EMAIL;
    if (email === undefined) return;
    const criado = await this.db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(${TRAVA_ADMIN_INICIAL})`);
      const [contagem] = await tx
        .select({ total: count() })
        .from(usuario)
        .where(and(eq(usuario.papel, 'ADMIN'), eq(usuario.ativo, true)));
      if ((contagem?.total ?? 0) > 0) return false;
      await tx.execute(sql`
        insert into usuario (email, nome, papel, ativo) values (${email}, 'Administrador', 'ADMIN', true)
        on conflict (lower(email)) do update set papel = 'ADMIN', ativo = true`);
      return true;
    });
    if (criado) this.logger.log(`administrador inicial criado: ${mascararEmail(email)}`);
  }
}
