package io.escritor.presenca.kanban.web;

import jakarta.validation.constraints.NotBlank;

public record CriarQuadroRequest(@NotBlank String nome, Long projetoId, Long equipeId) {
}
