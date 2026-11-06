import { Module } from '@nestjs/common';
import { ClientesController } from './clientes.controller';
import { ClientesService } from './clientes.service';
import { TitularController } from './titular.controller';

/** Exemplo de entidade com dado pessoal (skill lgpd-dados-pessoais). Chaves e auditoria vêm de módulos globais. */
@Module({
  controllers: [ClientesController, TitularController],
  providers: [ClientesService],
})
export class ClientesModule {}
