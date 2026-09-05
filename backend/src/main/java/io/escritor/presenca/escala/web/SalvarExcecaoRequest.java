package io.escritor.presenca.escala.web;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;
import java.time.LocalTime;

public record SalvarExcecaoRequest(
        @NotNull LocalDate data,
        boolean trabalha,
        LocalTime horaInicio,
        LocalTime horaFim,
        @Size(max = 200) String observacao) {
}
