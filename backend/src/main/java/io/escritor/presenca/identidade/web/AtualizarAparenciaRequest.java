package io.escritor.presenca.identidade.web;

import io.escritor.presenca.identidade.domain.EstiloBottom;
import io.escritor.presenca.identidade.domain.EstiloCabelo;
import io.escritor.presenca.identidade.domain.EstiloJaqueta;
import io.escritor.presenca.identidade.domain.EstiloOutro;
import io.escritor.presenca.identidade.domain.EstiloSapato;
import io.escritor.presenca.identidade.domain.EstiloTop;
import io.escritor.presenca.identidade.domain.TipoBarba;
import io.escritor.presenca.identidade.domain.TipoChapeu;
import io.escritor.presenca.identidade.domain.TipoOculos;
import io.escritor.presenca.identidade.domain.TipoRosto;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

/** Os campos de estilo são enums tipados de propósito - o Jackson já rejeita um valor fora do
 * enum com 400 antes mesmo de chegar no controller. As cores continuam `String` (hex) - validadas
 * contra a paleta curada em {@code PaletaAparenciaAvatar#validar}, não por Bean Validation aqui (a
 * paleta pode mudar sem mexer neste DTO). `tipoRosto` usa `corPele` (sem paleta própria). */
public record AtualizarAparenciaRequest(
        @NotBlank String corPele,
        @NotNull TipoRosto tipoRosto,
        @NotNull EstiloCabelo estiloCabelo,
        @NotBlank String corCabelo,
        @NotNull TipoBarba tipoBarba,
        @NotNull EstiloTop estiloTop,
        @NotBlank String corTop,
        @NotNull EstiloJaqueta estiloJaqueta,
        @NotBlank String corJaqueta,
        @NotNull EstiloBottom estiloBottom,
        @NotBlank String corBottom,
        @NotNull EstiloSapato estiloSapato,
        @NotBlank String corSapato,
        @NotNull TipoChapeu chapeu,
        @NotBlank String corChapeu,
        @NotNull TipoOculos oculos,
        @NotBlank String corOculos,
        @NotNull EstiloOutro estiloOutro,
        @NotBlank String corOutro) {
}
