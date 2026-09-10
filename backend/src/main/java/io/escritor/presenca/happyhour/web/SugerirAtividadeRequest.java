package io.escritor.presenca.happyhour.web;

import jakarta.validation.constraints.NotBlank;

public record SugerirAtividadeRequest(@NotBlank String descricao) {}
