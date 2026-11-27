import { Module } from '@nestjs/common';
import { ExportacaoModule } from '../exportacao/exportacao.module';
import { ClientesController } from './clientes.controller';
import { ClientesService } from './clientes.service';
import { TitularController } from './titular.controller';

/** Exemplo de entidade com dado pessoal (skill lgpd-dados-pessoais). Chaves e auditoria vêm de módulos globais. */
@Module({
  imports: [ExportacaoModule],
  controllers: [ClientesController, TitularController],
  providers: [ClientesService],
})
export class ClientesModule {}
