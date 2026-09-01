package io.escritor.presenca.apontamento.web;

/** {@code cardTitulo} (novo) - antes só tinha o id, sem nome nenhum pra mostrar; usado pela tela
 * "Jornada de hoje" (frontend) pra listar quanto tempo foi apontado em cada tarefa, não só o
 * total agregado. */
public record TotalPorCardResponse(Long cardId, String cardTitulo, long totalMinutos) {
}
