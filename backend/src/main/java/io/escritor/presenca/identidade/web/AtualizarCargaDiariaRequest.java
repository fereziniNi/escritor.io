package io.escritor.presenca.identidade.web;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

public record AtualizarCargaDiariaRequest(@NotNull @Positive Integer cargaDiariaMinutos) {
}
