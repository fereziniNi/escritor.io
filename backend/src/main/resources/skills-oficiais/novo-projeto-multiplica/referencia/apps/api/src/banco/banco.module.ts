// origem: skills-modelo/estagios/novo-projeto-multiplica/apps/api/src/banco/banco.module.ts
import { type DynamicModule, Global, Inject, Module, type OnApplicationShutdown } from '@nestjs/common';
import { type Config } from '../config/config';
import { BANCO, type Db, criarBanco } from './banco';

@Global()
@Module({})
export class BancoModule implements OnApplicationShutdown {
  constructor(@Inject(BANCO) private readonly db: Db) {}

  static registrar(config: Config): DynamicModule {
    return {
      module: BancoModule,
      providers: [{ provide: BANCO, useFactory: () => criarBanco(config.DATABASE_URL.revelar()) }],
      exports: [BANCO],
    };
  }

  /** Fecha o pool no desligamento (SIGTERM do Docker), depois que o Nest parou de receber requisições. */
  async onApplicationShutdown(): Promise<void> {
    await this.db.$client.end();
  }
}
