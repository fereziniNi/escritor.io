package io.escritor.presenca.identidade.web;

import io.escritor.presenca.identidade.domain.StatusProjeto;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;

public record CriarProjetoRequest(
        @NotBlank String nome,
        @NotBlank String cliente,
        @NotNull StatusProjeto status,
        @NotNull LocalDate inicio,
        LocalDate fimPrevisto) {
}
