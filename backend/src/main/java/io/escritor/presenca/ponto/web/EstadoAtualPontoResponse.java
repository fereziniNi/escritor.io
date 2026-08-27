package io.escritor.presenca.ponto.web;

import io.escritor.presenca.ponto.domain.TipoRegistroPonto;
import java.util.Set;

public record EstadoAtualPontoResponse(TipoRegistroPonto ultimoTipo, Set<TipoRegistroPonto> proximasOpcoes) {
}
