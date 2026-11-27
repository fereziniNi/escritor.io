import { Inject, Module, type OnApplicationShutdown } from '@nestjs/common';
import { type Config } from '../config/config';
import { CONFIG } from '../config/config.module';
import { type ClienteIa, criarClienteIa, exigirConfigIa } from './cliente-ia';
import { IaController } from './ia.controller';
import { IaService } from './ia.service';
import { type Rastreio, criarRastreio } from './rastreio';
import { CLIENTE_IA, RASTREIO } from './tokens';

/**
 * IA (skill ia-langfuse). Config, banco e auditoria vêm de módulos globais. Quem precisar chamar o modelo injeta `CLIENTE_IA`
 * (`@Inject(CLIENTE_IA) ia: ClienteIa`) e usa `ia.gerar({ tarefa: 'resumo', ... })`; o modelo da tarefa vem de `modeloPara`.
 * Fora de development/test, IA_HABILITADA=true sem ANTHROPIC_API_KEY impede a API de subir.
 */
@Module({
  controllers: [IaController],
  providers: [
    {
      provide: RASTREIO,
      inject: [CONFIG],
      useFactory: (config: Config): Rastreio => {
        exigirConfigIa(config);
        return criarRastreio(config);
      },
    },
    { provide: CLIENTE_IA, inject: [CONFIG, RASTREIO], useFactory: (config: Config, rastreio: Rastreio): ClienteIa => criarClienteIa(config, { rastreio }) },
    IaService,
  ],
  exports: [CLIENTE_IA, IaService],
})
export class IaModule implements OnApplicationShutdown {
  constructor(@Inject(RASTREIO) private readonly rastreio: Rastreio) {}

  /** Descarrega os spans pendentes no Langfuse antes de o processo sair. */
  async onApplicationShutdown(): Promise<void> {
    await this.rastreio.encerrar();
  }
}
