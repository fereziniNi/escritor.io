package io.escritor.presenca.ponto.web;

import io.escritor.presenca.ponto.domain.EstadoDia;
import java.time.LocalDate;

public record EspelhoDiaResponse(LocalDate data, EstadoDia estado, long minutosTrabalhados, long saldoDia) {
}
