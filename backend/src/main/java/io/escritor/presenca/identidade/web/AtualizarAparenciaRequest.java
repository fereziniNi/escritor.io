package io.escritor.presenca.identidade.web;

import io.escritor.presenca.identidade.domain.EstiloCabelo;
import io.escritor.presenca.identidade.domain.EstiloRoupa;
import io.escritor.presenca.identidade.domain.TipoBarba;
import io.escritor.presenca.identidade.domain.TipoChapeu;
import io.escritor.presenca.identidade.domain.TipoOculos;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

/** Os campos de estilo (incluindo `tipoBarba`, novo) são enums tipados de propósito - o Jackson já
 * rejeita um valor fora do enum com 400 antes mesmo de chegar no controller, sem precisar de
 * validação manual pra isso. As 3 cores continuam `String` (hex) - validadas contra a paleta
 * curada em {@code PaletaAparenciaAvatar#validar}, não por Bean Validation aqui (a paleta pode
 * mudar sem mexer neste DTO). */
public record AtualizarAparenciaRequest(
        @NotBlank String corPele,
        @NotNull EstiloCabelo estiloCabelo,
        @NotBlank String corCabelo,
        @NotNull EstiloRoupa estiloRoupa,
        @NotBlank String corRoupa,
        @NotNull TipoOculos oculos,
        @NotNull TipoChapeu chapeu,
        @NotNull TipoBarba tipoBarba) {
}
