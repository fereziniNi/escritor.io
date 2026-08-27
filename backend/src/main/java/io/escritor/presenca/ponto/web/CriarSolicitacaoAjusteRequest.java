package io.escritor.presenca.ponto.web;

import io.escritor.presenca.ponto.domain.TipoRegistroPonto;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.Instant;

/**
 * Sem campo de usuário de propósito - quem está solicitando é sempre quem está autenticado
 * (resolvido no controller via {@code ContextoUsuarioAutenticado}), nunca um valor vindo do
 * cliente. {@code registroAlvoId} é opcional: {@code null} = marcação esquecida.
 */
public record CriarSolicitacaoAjusteRequest(
        @NotNull TipoRegistroPonto tipo, @NotNull Instant momento, Long registroAlvoId, @NotBlank String justificativa) {
}
