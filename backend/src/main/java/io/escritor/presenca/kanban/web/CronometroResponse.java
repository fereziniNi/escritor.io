package io.escritor.presenca.kanban.web;

import java.time.Instant;

/**
 * Estado do cronômetro de um card (pedido do usuário: "um contador de tempo onde a pessoa
 * inicia, pausa e finaliza"). {@code iniciadoEm} não nulo = existe uma sessão aberta agora (o
 * front usa isso pra tocar o relógio ao vivo: {@code totalMinutosFechados} + o tempo decorrido
 * desde {@code iniciadoEm}). {@code concluidoEm} não nulo = a tarefa já foi finalizada -
 * {@code descricaoConclusao} é "o que foi feito", pedida nesse momento.
 */
public record CronometroResponse(
        Long cardId, Instant iniciadoEm, long totalMinutosFechados, String descricaoConclusao, Instant concluidoEm) {
}
