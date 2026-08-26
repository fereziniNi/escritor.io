package io.escritor.presenca.identidade.web;

import io.escritor.presenca.identidade.domain.Papel;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

public record CriarUsuarioRequest(
        @NotBlank String nome,
        @NotBlank @Email String email,
        @NotNull Papel papel,
        @NotNull @Positive Integer cargaDiariaMinutos) {
}
