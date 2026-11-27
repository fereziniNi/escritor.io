package io.escritor.presenca.identidade.web;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import java.time.LocalDate;

/** {@code vigenteDesde} opcional: em branco = hoje. A nova carga vale a partir dessa data e não
 * altera o saldo de dias anteriores. */
public record AtualizarCargaDiariaRequest(@NotNull @Positive Integer cargaDiariaMinutos, LocalDate vigenteDesde) {
}
