// origem: skills-modelo/apps/api/src/auth/auth.module.ts
import { type MiddlewareConsumer, Module, type NestModule, RequestMethod } from '@nestjs/common';
import { EmailModule } from '../email/email.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { REGISTRO_EVENTOS, RegistroEventosNulo } from './registro-eventos';
import { SessaoGuard, SessaoMiddleware } from './sessao.guard';

/**
 * Login por código no e-mail. O SessaoMiddleware roda em toda a /api e preenche `req.usuario`. Importado no AppModule
 * DEPOIS do SegurancaModule (limite e origem antes de consultar a sessão no banco).
 * REGISTRO_EVENTOS: a skill trilha-auditoria troca o RegistroEventosNulo pela implementação dela.
 */
@Module({
  imports: [EmailModule],
  controllers: [AuthController],
  providers: [AuthService, SessaoGuard, { provide: REGISTRO_EVENTOS, useClass: RegistroEventosNulo }],
  exports: [AuthService, SessaoGuard, REGISTRO_EVENTOS],
})
export class AuthModule implements NestModule {
  configure(consumidor: MiddlewareConsumer): void {
    consumidor.apply(SessaoMiddleware).forRoutes({ path: '{/*caminho}', method: RequestMethod.ALL });
  }
}
