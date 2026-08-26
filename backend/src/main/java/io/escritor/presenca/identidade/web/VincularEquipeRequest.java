package io.escritor.presenca.identidade.web;

import jakarta.validation.constraints.NotNull;

public record VincularEquipeRequest(@NotNull Long equipeId) {
}
