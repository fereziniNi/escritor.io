package io.escritor.presenca.identidade.web;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

public record AtualizarPerfilRequest(@NotBlank String nome, @NotBlank @Email String email) {
}
