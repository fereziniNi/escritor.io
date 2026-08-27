package io.escritor.presenca.ponto.web;

import java.util.List;

public record EspelhoMesResponse(List<EspelhoDiaResponse> dias, long saldoAcumuladoNoPeriodo) {
}
