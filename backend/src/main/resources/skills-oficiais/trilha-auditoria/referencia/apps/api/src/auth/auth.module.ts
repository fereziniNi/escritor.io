// origem: skills-modelo/apps/api/src/auth/auth.module.ts
import { type MiddlewareConsumer, Module, type NestModule, RequestMethod } from '@nestjs/common';
import { RegistroEventosAuditoria } from '../auditoria/registro-eventos-auditoria';
import { EmailModule } from '../email/email.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { REGISTRO_EVENTOS } from './registro-eventos';
import { SessaoGuard, SessaoMiddleware } from './sessao.guard';

/**
 * Login por código no e-mail. O SessaoMiddleware roda em toda a /api e preenche `req.usuario`. Importado no AppModule
 * DEPOIS do SegurancaModule (limite e origem antes de consultar a sessão no banco).
 * REGISTRO_EVENTOS: login, logout e falhas vão para a trilha de auditoria (skill trilha-auditoria; antes dela, o
 * provedor era o RegistroEventosNulo de registro-eventos.ts, que não grava).
 */
@Module({
  imports: [EmailModule],
  controllers: [AuthController],
  providers: [AuthService, SessaoGuard, { provide: REGISTRO_EVENTOS, useExisting: RegistroEventosAuditoria }],
  exports: [AuthService, SessaoGuard, REGISTRO_EVENTOS],
})
export class AuthModule implements NestModule {
  configure(consumidor: MiddlewareConsumer): void {
    consumidor.apply(SessaoMiddleware).forRoutes({ path: '{/*caminho}', method: RequestMethod.ALL });
  }
}
