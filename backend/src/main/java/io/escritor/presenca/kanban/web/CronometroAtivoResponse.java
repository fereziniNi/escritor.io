package io.escritor.presenca.kanban.web;

import java.time.Instant;

/** Pedido do usuário: widget global (canto superior direito, vermelho) da tarefa que a pessoa
 * está com o cronômetro rodando agora - carrega o suficiente pra mostrar o relógio ao vivo
 * (`iniciadoEm`/`totalMinutosFechados`, mesmo cálculo de {@link CronometroResponse}) e pra navegar
 * direto até o card ao clicar (`cardId`/`projetoId`), sem precisar de outra chamada. */
public record CronometroAtivoResponse(Long cardId, String cardTitulo, Long projetoId, Instant iniciadoEm, long totalMinutosFechados) {}
