import { Module } from '@nestjs/common';
import { ExportacaoService } from './exportacao.service';

/** Exportação Excel/PDF/CSV (skill exportacao-excel-pdf-csv). Config e auditoria vêm de módulos globais. */
@Module({
  providers: [ExportacaoService],
  exports: [ExportacaoService],
})
export class ExportacaoModule {}
