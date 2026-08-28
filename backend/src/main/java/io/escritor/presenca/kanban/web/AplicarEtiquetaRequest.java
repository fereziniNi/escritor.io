package io.escritor.presenca.kanban.web;

import jakarta.validation.constraints.NotNull;

public record AplicarEtiquetaRequest(@NotNull Long etiquetaId) {
}
