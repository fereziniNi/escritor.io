package io.escritor.presenca.identidade.web;

import io.escritor.presenca.identidade.domain.Papel;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;

/** {@code whatsapp} opcional (pedido do usuário: avisar por WhatsApp quando uma tarefa é
 * concluída/mensagem de chat chega) - {@code null} ou vazio é válido (ninguém é obrigado a
 * cadastrar); quando preenchido, só dígitos (código do país + DDD + número, mesmo formato de
 * {@code app.evolution.chefe-numero}). */
public record CriarUsuarioRequest(
        @NotBlank String nome,
        @NotBlank @Email String email,
        @NotNull Papel papel,
        @NotNull @Positive Integer cargaDiariaMinutos,
        @Pattern(regexp = "^$|^\\d{10,15}$", message = "Whatsapp deve conter só dígitos (código do país + DDD + número)") String whatsapp) {
}
