package io.escritor.presenca.relatorio.web;

import java.time.Instant;

/** Pedido do usuário: "quantidade de atividades feitas, o que fez" - uma tarefa concluída, com o
 * suficiente pra listar "o que a pessoa fez" sem precisar de outra chamada. */
public record TarefaConcluidaResponse(Long cardId, String titulo, String nomeProjeto, Instant concluidoEm, String descricaoConclusao) {
}
