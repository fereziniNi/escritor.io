import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { type Config } from '../config/config';
import { CONFIG } from '../config/config.module';
import { CHAVES_LGPD, carregarChavesLgpd } from './chaves';
import { MascararDadosPessoaisInterceptor } from './mascarar-dados.interceptor';

/**
 * Dados pessoais (LGPD). Global: qualquer módulo injeta `CHAVES_LGPD` (chaveiro AES-256-GCM + índice cego) sem
 * importar este. Liga a máscara por papel em TODAS as respostas. Sem as chaves, fora de dev, a API não sobe.
 */
@Global()
@Module({
  providers: [
    { provide: CHAVES_LGPD, inject: [CONFIG], useFactory: (config: Config) => carregarChavesLgpd(config) },
    { provide: APP_INTERCEPTOR, useClass: MascararDadosPessoaisInterceptor },
  ],
  exports: [CHAVES_LGPD],
})
export class LgpdModule {}
