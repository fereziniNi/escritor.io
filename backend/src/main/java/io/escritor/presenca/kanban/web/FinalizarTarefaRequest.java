package io.escritor.presenca.kanban.web;

import jakarta.validation.constraints.NotBlank;

/** Pedido do usuário: "descreve o que foi feito quando finaliza a tarefa". */
public record FinalizarTarefaRequest(@NotBlank String descricao) {
}
