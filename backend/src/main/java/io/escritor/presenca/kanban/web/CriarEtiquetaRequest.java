package io.escritor.presenca.kanban.web;

import jakarta.validation.constraints.NotBlank;

public record CriarEtiquetaRequest(@NotBlank String nome, @NotBlank String cor) {
}
