// origem: skills-modelo/apps/api/src/armazenamento/armazenamento.module.ts
import { Module } from '@nestjs/common';
import { type Config } from '../config/config';
import { CONFIG } from '../config/config.module';
import { ANTIVIRUS } from './antivirus';
import { ARMAZENAMENTO } from './armazenamento';
import { ArquivosController } from './arquivos.controller';
import { ArquivosService } from './arquivos.service';
import { criarAntivirus, criarArmazenamento } from './fabrica';

/**
 * Upload e armazenamento (skill upload-armazenamento). Config, banco e auditoria vêm de módulos globais. Quem precisar guardar
 * arquivo em outra parte do sistema injeta `ARMAZENAMENTO` (e usa `limitarTamanho`/`validarTipo`) ou o `ArquivosService`.
 */
@Module({
  controllers: [ArquivosController],
  providers: [
    { provide: ARMAZENAMENTO, inject: [CONFIG], useFactory: (config: Config) => criarArmazenamento(config) },
    { provide: ANTIVIRUS, inject: [CONFIG], useFactory: (config: Config) => criarAntivirus(config) },
    ArquivosService,
  ],
  exports: [ArquivosService, ARMAZENAMENTO],
})
export class ArmazenamentoModule {}
