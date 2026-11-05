// origem: skills-modelo/apps/api/src/usuarios/usuarios.module.ts
import { Module } from '@nestjs/common';
import { EmailModule } from '../email/email.module';
import { AdminInicial } from './admin-inicial';
import { UsuariosController } from './usuarios.controller';
import { UsuariosService } from './usuarios.service';

@Module({
  imports: [EmailModule],
  controllers: [UsuariosController],
  providers: [UsuariosService, AdminInicial],
  exports: [UsuariosService],
})
export class UsuariosModule {}
