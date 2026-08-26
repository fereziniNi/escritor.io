package io.escritor.presenca.identidade.web;

import io.escritor.presenca.identidade.domain.PapelNaEquipe;
import jakarta.validation.constraints.NotNull;

public record AdicionarMembroRequest(@NotNull Long usuarioId, @NotNull PapelNaEquipe papelNaEquipe) {
}
