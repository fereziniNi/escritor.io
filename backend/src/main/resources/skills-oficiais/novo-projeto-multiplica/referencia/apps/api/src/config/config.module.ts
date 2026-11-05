// origem: skills-modelo/apps/api/src/config/config.module.ts
import { type DynamicModule, Global, Module } from '@nestjs/common';
import { type Config } from './config';

/** Token de injeção da configuração validada (`@Inject(CONFIG) config: Config`). */
export const CONFIG = Symbol('CONFIG');

@Global()
@Module({})
export class ConfigModule {
  /** A configuração é carregada e validada uma vez, no main.ts, antes de o Nest subir. */
  static registrar(config: Config): DynamicModule {
    return { module: ConfigModule, providers: [{ provide: CONFIG, useValue: config }], exports: [CONFIG] };
  }
}
