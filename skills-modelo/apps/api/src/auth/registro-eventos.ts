import { Injectable } from '@nestjs/common';

/** Eventos de segurança que o login registra. */
export type AcaoAuth =
  | 'auth.login'
  | 'auth.logout'
  | 'auth.falha_login'
  /** 5 tentativas erradas (ou a 6ª) no mesmo código: o código não vale mais. */
  | 'auth.codigo_bloqueado'
  /** 4º pedido de código do mesmo e-mail em 10 min: nada foi enviado. */
  | 'auth.limite_codigo';

export interface EventoAuth {
  acao: AcaoAuth;
  usuarioId?: string;
  /** E-mail normalizado da tentativa (nunca o código nem o token). */
  email?: string;
  ip?: string;
}

/**
 * Ponto de ligação com a trilha de auditoria. O login chama `registrarEvento` em login, logout, falha, bloqueio do código
 * e limite de pedidos. Sem a skill `trilha-auditoria`, o provedor é o `RegistroEventosNulo` (não grava nada); a skill de
 * auditoria troca o provedor de `REGISTRO_EVENTOS` no AuthModule pela implementação que grava na tabela dela.
 * Uma falha ao registrar nunca impede o login nem muda a resposta (o AuthService registra o erro no log e segue).
 */
export interface RegistroEventos {
  registrarEvento(evento: EventoAuth): Promise<void>;
}

/** Token de injeção: `@Inject(REGISTRO_EVENTOS) eventos: RegistroEventos`. */
export const REGISTRO_EVENTOS = Symbol('REGISTRO_EVENTOS');

/** Padrão enquanto a trilha de auditoria não existe: não faz nada. */
@Injectable()
export class RegistroEventosNulo implements RegistroEventos {
  registrarEvento(_evento: EventoAuth): Promise<void> {
    return Promise.resolve();
  }
}
