// origem: skills-modelo/packages/contratos/src/auditoria.spec.ts
import { describe, expect, it } from 'vitest';
import { esquemaConsultaAuditoria, esquemaEventoAuditoria, esquemaPaginaAuditoria } from './auditoria.js';

const evento = {
  id: '12',
  ocorridoEm: '2026-11-05T12:00:00.000Z',
  atorId: '2c8a8f3e-6f5b-4c5e-9d0f-6a1a3f7b9c11',
  atorEmail: 'ana@exemplo.com.br',
  acao: 'usuario.desativar',
  alvoTipo: 'usuario',
  alvoId: '7d1b0c2e-1f3a-4b8d-8e7c-5a9b2c4d6e80',
  antes: { ativo: true },
  depois: { ativo: false },
  ip: '192.0.2.5',
  requestId: 'req-12345678',
};

describe('contratos da auditoria', () => {
  it('aceita um evento completo e um evento só com a ação (campos opcionais nulos)', () => {
    expect(esquemaEventoAuditoria.parse(evento)).toEqual(evento);
    const vazio = { atorId: null, atorEmail: null, alvoTipo: null, alvoId: null, antes: null, depois: null, ip: null, requestId: null };
    const lido = esquemaEventoAuditoria.parse({ id: '1', ocorridoEm: evento.ocorridoEm, acao: 'auth.falha_login', ...vazio });
    expect(lido.acao).toBe('auth.falha_login');
  });

  it('página: itens e cursor (nulo na última)', () => {
    expect(esquemaPaginaAuditoria.parse({ itens: [evento], proximoCursor: '12' }).proximoCursor).toBe('12');
    expect(esquemaPaginaAuditoria.parse({ itens: [], proximoCursor: null }).itens).toEqual([]);
  });

  it('consulta: período com fuso, ator uuid, ação no formato grupo.acao, limite 1 a 200 (padrão 50)', () => {
    const q = esquemaConsultaAuditoria.parse({
      de: '2026-11-01T00:00:00-03:00',
      ate: '2026-11-05T23:59:59.999-03:00',
      atorId: evento.atorId,
      acao: 'usuario.convidar',
    });
    expect(q.acao).toBe('usuario.convidar');
    expect(q.limite).toBe(50);
    expect(esquemaConsultaAuditoria.parse({}).limite).toBe(50);
    expect(esquemaConsultaAuditoria.parse({ limite: '200' }).limite).toBe(200);
  });

  it('consulta: recusa data sem fuso, ator que não é uuid, ação com maiúscula ou espaço, limite fora da faixa e cursor não numérico', () => {
    expect(esquemaConsultaAuditoria.safeParse({ de: '2026-11-01' }).success).toBe(false);
    expect(esquemaConsultaAuditoria.safeParse({ atorId: 'ana' }).success).toBe(false);
    expect(esquemaConsultaAuditoria.safeParse({ acao: 'Usuario Convidar' }).success).toBe(false);
    expect(esquemaConsultaAuditoria.safeParse({ limite: '201' }).success).toBe(false);
    expect(esquemaConsultaAuditoria.safeParse({ limite: '0' }).success).toBe(false);
    expect(esquemaConsultaAuditoria.safeParse({ cursor: 'abc' }).success).toBe(false);
  });

  it('consulta: texto vazio (formulário em branco) vale como ausente', () => {
    expect(esquemaConsultaAuditoria.parse({ de: '', ate: '', atorId: '', acao: '', cursor: '' })).toEqual({ limite: 50 });
  });
});
