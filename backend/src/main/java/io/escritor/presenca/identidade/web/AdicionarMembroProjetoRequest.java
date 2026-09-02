package io.escritor.presenca.identidade.web;

import jakarta.validation.constraints.NotNull;

public record AdicionarMembroProjetoRequest(@NotNull Long usuarioId) {
}
