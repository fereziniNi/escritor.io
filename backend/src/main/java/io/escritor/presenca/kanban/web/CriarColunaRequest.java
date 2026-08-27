package io.escritor.presenca.kanban.web;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record CriarColunaRequest(@NotBlank String nome, @NotNull Integer ordem, Integer limiteWip) {
}
