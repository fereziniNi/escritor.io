package io.escritor.presenca.identidade.web;

import jakarta.validation.constraints.Pattern;

/** ADMIN-only (ver {@code UsuarioController#atualizarWhatsapp}), mesmo espírito de {@code
 * AtualizarCargaDiariaRequest}. {@code whatsapp} vazio/em branco é válido de propósito - é como se
 * desliga o aviso por WhatsApp pra um colaborador (ver {@code Usuario#alterarWhatsapp}). */
public record AtualizarWhatsappRequest(
        @Pattern(regexp = "^$|^\\d{10,15}$", message = "Whatsapp deve conter só dígitos (código do país + DDD + número)") String whatsapp) {
}
