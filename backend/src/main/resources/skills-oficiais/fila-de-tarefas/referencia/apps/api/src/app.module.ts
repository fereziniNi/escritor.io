// origem: skills-modelo/estagios/fila-de-tarefas/apps/api/src/app.module.ts
import { type DynamicModule, Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { type DestinationStream } from 'pino';
import { ArmazenamentoModule } from './armazenamento/armazenamento.module';
import { AuditoriaModule } from './auditoria/auditoria.module';
import { AuthModule } from './auth/auth.module';
import { BancoModule } from './banco/banco.module';
import { ClientesModule } from './clientes/clientes.module';
import { type Config } from './config/config';
import { ConfigModule } from './config/config.module';
import { EmailModule } from './email/email.module';
import { FilaModule } from './fila/fila.module';
import { FiltroErros } from './http/filtro-erros';
import { LgpdModule } from './lgpd/lgpd.module';
import { LogModule } from './log/log.module';
import { SaudeModule } from './saude/saude.module';
import { SegurancaModule } from './seguranca/seguranca.module';
import { UsuariosModule } from './usuarios/usuarios.module';

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
      // SegurancaModule logo depois do LogModule: limite e checagem de origem já com request-id e log.
      // AuthModule depois do SegurancaModule: a sessão só é consultada no banco depois do limite e da origem.
      // ArmazenamentoModule (upload): depois do AuthModule, usa a sessão, a auditoria e o limite por usuário.
      // FilaModule (global): tarefas em segundo plano; depois do EmailModule (o alerta de falha envia e-mail) e do BancoModule.
      // LgpdModule (global): chaves da criptografia de campo e máscara de CPF/e-mail por papel em toda resposta.
      imports: [
        ConfigModule.registrar(config),
        LogModule.registrar(config, opcoes.destinoLog),
        SegurancaModule,
        BancoModule.registrar(config),
        AuditoriaModule,
        LgpdModule,
        EmailModule,
        FilaModule,
        UsuariosModule,
        AuthModule,
        ClientesModule,
        ArmazenamentoModule,
        SaudeModule,
      ],
      // Erros sempre em JSON padrão ({ status, erro, requestId }), inclusive o 404 de /api/* desconhecido.
      providers: [{ provide: APP_FILTER, useClass: FiltroErros }],
    };
  }
}
