package io.escritor.presenca.escala.web;

import jakarta.validation.constraints.NotNull;
import java.time.DayOfWeek;
import java.time.LocalTime;

public record ItemEscalaSemanalRequest(@NotNull DayOfWeek diaSemana, @NotNull LocalTime horaInicio, @NotNull LocalTime horaFim) {
}
