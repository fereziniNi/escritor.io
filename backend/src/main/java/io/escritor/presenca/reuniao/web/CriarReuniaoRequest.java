package io.escritor.presenca.reuniao.web;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

public record CriarReuniaoRequest(
        @NotEmpty List<Long> participantesIds,
        @NotNull LocalDate data,
        @NotNull LocalTime horaInicio,
        @NotNull LocalTime horaFim,
        @NotBlank @Size(max = 200) String titulo) {
}
