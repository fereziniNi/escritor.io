package io.escritor.presenca.kanban.web;

/** {@code cardTitulo} - usado pela tela "Jornada de hoje" (frontend) pra listar quanto tempo foi
 * trabalhado em cada tarefa, não só o total agregado. */
public record TotalPorCardResponse(Long cardId, String cardTitulo, long totalMinutos) {
}
