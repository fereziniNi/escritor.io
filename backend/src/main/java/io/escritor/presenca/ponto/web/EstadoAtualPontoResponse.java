package io.escritor.presenca.ponto.web;

import io.escritor.presenca.ponto.domain.TipoRegistroPonto;
import java.time.Instant;
import java.util.Set;

/** {@code segundosTrabalhadosAteAgora} (`JornadaDiaria.segundosTrabalhadosAteAgora`) é a base que o
 * cronômetro ao vivo do frontend usa - diferente de {@code minutosTrabalhados} de
 * {@code /ponto/jornada-do-dia}, que só soma intervalos *fechados* e nunca inclui o segmento em
 * andamento, este já inclui. {@code ultimoMomento} continua disponível separado (horário da última
 * marcação) pra outros usos que só precisem dele, não do total calculado. */
public record EstadoAtualPontoResponse(
        TipoRegistroPonto ultimoTipo, Instant ultimoMomento, long segundosTrabalhadosAteAgora, Set<TipoRegistroPonto> proximasOpcoes) {
}
