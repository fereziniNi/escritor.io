// origem: skills-modelo/apps/api/src/lgpd/retencao.ts
import { and, eq, isNotNull, isNull, lt, sql } from 'drizzle-orm';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { type Db } from '../banco/banco';
import { cliente, codigoLogin, sessao } from '../banco/esquema';
import { anonimizarCliente } from '../clientes/clientes.service';
import { type Config } from '../config/config';

const DIA_MS = 24 * 60 * 60 * 1000;

export interface ResultadoRetencao {
  /** false quando RETENCAO_DIAS não está definida: nada é expurgado (prazo a definir com o jurídico/DPO). */
  ligada: boolean;
  clientes: number;
  codigos: number;
  sessoes: number;
}

/**
 * Retenção (comando `pnpm --filter api lgpd:retencao`; a skill fila-de-tarefas pode agendá-lo). Roda com o papel de
 * RUNTIME (a conexão da API), fora de requisição. Com RETENCAO_DIAS = N:
 * - cliente encerrado há mais de N dias → anonimizado (mesma função da rota do titular; evento `lgpd.anonimizar_titular`
 *   com `motivo: retencao`, sem ator);
 * - código de login criado há mais de N dias → apagado;
 * - sessão criada há mais de N dias E mais velha que AUTH_SESSAO_ABSOLUTA_H (já vencida de qualquer jeito) → apagada.
 * Um evento `lgpd.retencao` resume a execução. Idempotente: rodar de novo não acha nada.
 */
export async function executarRetencao(opcoes: { db: Db; config: Config; agora?: Date }): Promise<ResultadoRetencao> {
  const { db, config } = opcoes;
  const dias = config.RETENCAO_DIAS;
  if (dias === undefined) return { ligada: false, clientes: 0, codigos: 0, sessoes: 0 };
  const agora = opcoes.agora ?? new Date();
  const corte = new Date(agora.getTime() - dias * DIA_MS);
  const corteSessao = new Date(Math.min(corte.getTime(), agora.getTime() - config.AUTH_SESSAO_ABSOLUTA_H * 60 * 60 * 1000));
  const auditoria = new AuditoriaService(db, config);

  const vencidos = await db
    .select({ id: cliente.id })
    .from(cliente)
    .where(and(isNotNull(cliente.encerradoEm), lt(cliente.encerradoEm, corte), isNull(cliente.anonimizadoEm)));
  let clientes = 0;
  for (const { id } of vencidos) {
    // Uma transação por titular: um erro no meio não desfaz os já anonimizados e o próximo run continua de onde parou.
    const feito = await db.transaction(async (tx) => {
      const [atual] = await tx.select({ anonimizadoEm: cliente.anonimizadoEm }).from(cliente).where(eq(cliente.id, id)).for('update');
      if (!atual || atual.anonimizadoEm !== null) return false;
      await anonimizarCliente(tx, auditoria, id, { atorId: null, motivo: 'retencao' });
      return true;
    });
    if (feito) clientes++;
  }
  const codigos = (await db.delete(codigoLogin).where(lt(codigoLogin.criadoEm, corte)).returning({ id: codigoLogin.id })).length;
  const sessoes = (await db.delete(sessao).where(lt(sessao.criadaEm, corteSessao)).returning({ id: sessao.id })).length;
  // "pedidosLogin" e não "codigos": a trilha censura chaves com "codigo" (sanitizar.ts).
  await auditoria.registrar({ acao: 'lgpd.retencao', depois: { dias, clientes, pedidosLogin: codigos, sessoes } });
  return { ligada: true, clientes, codigos, sessoes };
}

/**
 * Expurgo do IP da trilha de auditoria (RETENCAO_AUDITORIA_IP_DIAS), regra 12 da skill trilha-auditoria: fora da API e
 * com o DONO do banco (DATABASE_URL), nunca com o runtime (que não tem UPDATE na trilha e falha aqui com "must be owner").
 * Numa transação só: desliga o gatilho de imutabilidade, apaga o `ip` dos eventos mais velhos que `dias`, registra
 * `auditoria.expurgo` e religa o gatilho. Erro em qualquer passo desfaz tudo, inclusive o "desligar" (DDL do Postgres é
 * transacional); a tabela fica travada (ACCESS EXCLUSIVE) durante a janela, então ninguém grava com o gatilho desligado.
 * Devolve quantos eventos perderam o IP.
 */
export async function expurgarIpAuditoria(dono: Db, dias: number, agora: Date = new Date()): Promise<number> {
  const corte = new Date(agora.getTime() - dias * DIA_MS);
  return dono.transaction(async (tx) => {
    await tx.execute(sql`ALTER TABLE evento_auditoria DISABLE TRIGGER evento_auditoria_sem_alteracao`);
    const r = await tx.execute(sql`UPDATE evento_auditoria SET ip = NULL WHERE ip IS NOT NULL AND ocorrido_em < ${corte}`);
    await tx.execute(sql`ALTER TABLE evento_auditoria ENABLE TRIGGER evento_auditoria_sem_alteracao`);
    const linhas = r.rowCount ?? 0;
    await tx.execute(
      sql`INSERT INTO evento_auditoria (acao, depois) VALUES ('auditoria.expurgo', ${JSON.stringify({ campo: 'ip', antesDe: corte.toISOString(), dias, linhas })}::jsonb)`,
    );
    return linhas;
  });
}
