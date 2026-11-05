import { Injectable } from '@nestjs/common';
import { type EventoAuth, type RegistroEventos } from '../auth/registro-eventos';
import { AuditoriaService } from './auditoria.service';
import { mascararEmail } from './sanitizar';

/**
 * Liga o login (skill login-codigo-email, token REGISTRO_EVENTOS) à trilha. Login, logout, falha, bloqueio do código e
 * limite de pedidos viram linhas em `evento_auditoria`. O e-mail da tentativa entra só mascarado; o código e o token
 * nunca chegam aqui (o EventoAuth nem tem esses campos).
 */
@Injectable()
export class RegistroEventosAuditoria implements RegistroEventos {
  constructor(private readonly auditoria: AuditoriaService) {}

  registrarEvento(evento: EventoAuth): Promise<void> {
    return this.auditoria.registrar({
      acao: evento.acao,
      atorId: evento.usuarioId ?? null,
      ...(evento.usuarioId ? { alvoTipo: 'usuario', alvoId: evento.usuarioId } : {}),
      depois: evento.email ? { email: mascararEmail(evento.email) } : null,
      ...(evento.ip === undefined ? {} : { ip: evento.ip }),
    });
  }
}
