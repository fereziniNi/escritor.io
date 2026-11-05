import { type DynamicModule, Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { type DestinationStream } from 'pino';
import { BancoModule } from './banco/banco.module';
import { type Config } from './config/config';
import { ConfigModule } from './config/config.module';
import { FiltroErros } from './http/filtro-erros';
import { LogModule } from './log/log.module';
import { SaudeModule } from './saude/saude.module';

export interface OpcoesApp {
  /** Destino dos logs (testes); padrão: stdout. */
  destinoLog?: DestinationStream;
}

@Module({})
export class AppModule {
  /** Cada skill que cria um módulo (usuarios, auditoria...) acrescenta o import aqui. */
  static registrar(config: Config, opcoes: OpcoesApp = {}): DynamicModule {
    return {
      module: AppModule,
      imports: [ConfigModule.registrar(config), LogModule.registrar(config, opcoes.destinoLog), BancoModule.registrar(config), SaudeModule],
      // Erros sempre em JSON padrão ({ status, erro, requestId }), inclusive o 404 de /api/* desconhecido.
      providers: [{ provide: APP_FILTER, useClass: FiltroErros }],
    };
  }
}
