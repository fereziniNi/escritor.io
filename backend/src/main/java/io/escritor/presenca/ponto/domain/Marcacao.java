package io.escritor.presenca.ponto.domain;

import java.time.Instant;

/**
 * Par (tipo, momento) desacoplado de {@link RegistroPonto} - a jornada é uma função pura sobre
 * marcações, não precisa da entidade JPA inteira (usuário, hash, origem etc).
 */
public record Marcacao(TipoRegistroPonto tipo, Instant momento) {
}
