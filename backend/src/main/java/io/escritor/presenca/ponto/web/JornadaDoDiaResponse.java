package io.escritor.presenca.ponto.web;

import io.escritor.presenca.ponto.domain.EstadoDia;
import java.time.LocalDate;

public record JornadaDoDiaResponse(
        LocalDate data,
        EstadoDia estado,
        long minutosTrabalhados,
        long saldoDia,
        long saldoAcumuladoNoPeriodo,
        long totalApontadoMinutos) {
}
