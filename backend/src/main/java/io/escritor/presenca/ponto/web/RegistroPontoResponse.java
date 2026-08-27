package io.escritor.presenca.ponto.web;

import io.escritor.presenca.ponto.domain.OrigemRegistroPonto;
import io.escritor.presenca.ponto.domain.RegistroPonto;
import io.escritor.presenca.ponto.domain.TipoRegistroPonto;
import java.time.Instant;

public record RegistroPontoResponse(Long id, TipoRegistroPonto tipo, Instant momento, OrigemRegistroPonto origem) {

    public static RegistroPontoResponse de(RegistroPonto registro) {
        return new RegistroPontoResponse(
                registro.getId(), registro.getTipo(), registro.getMomento(), registro.getOrigem());
    }
}
