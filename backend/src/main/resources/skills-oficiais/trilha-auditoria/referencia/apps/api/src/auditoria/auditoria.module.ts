// origem: skills-modelo/apps/api/src/auditoria/auditoria.module.ts
import { type MiddlewareConsumer, Global, Module, type NestModule, RequestMethod } from '@nestjs/common';
import { AuditoriaController } from './auditoria.controller';
import { AuditoriaService } from './auditoria.service';
import { ContextoRequisicaoMiddleware } from './contexto-requisicao';
import { RegistroEventosAuditoria } from './registro-eventos-auditoria';

/**
 * Trilha de auditoria. Global: qualquer módulo injeta `AuditoriaService` sem importar este. O AuthModule usa o
 * `RegistroEventosAuditoria` como provedor de REGISTRO_EVENTOS (login, logout, falhas). O middleware guarda IP e
 * request-id da requisição para o `registrar` ler.
 */
@Global()
@Module({
  controllers: [AuditoriaController],
  providers: [AuditoriaService, RegistroEventosAuditoria],
  exports: [AuditoriaService, RegistroEventosAuditoria],
})
export class AuditoriaModule implements NestModule {
  configure(consumidor: MiddlewareConsumer): void {
    consumidor.apply(ContextoRequisicaoMiddleware).forRoutes({ path: '{/*caminho}', method: RequestMethod.ALL });
  }
}
