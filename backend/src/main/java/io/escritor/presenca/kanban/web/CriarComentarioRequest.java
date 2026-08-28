package io.escritor.presenca.kanban.web;

import jakarta.validation.constraints.NotBlank;

public record CriarComentarioRequest(@NotBlank String texto) {
}
