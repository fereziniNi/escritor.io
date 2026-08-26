package io.escritor.presenca.identidade.web;

import jakarta.validation.constraints.NotBlank;

public record CriarEquipeRequest(@NotBlank String nome, String descricao) {
}
