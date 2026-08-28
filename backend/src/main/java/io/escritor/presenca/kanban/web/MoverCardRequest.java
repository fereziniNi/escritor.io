package io.escritor.presenca.kanban.web;

import jakarta.validation.constraints.NotNull;

public record MoverCardRequest(@NotNull Long colunaId, @NotNull Integer indice) {
}
