package io.escritor.presenca.escala.web;

import io.escritor.presenca.escala.domain.EscalaSemanal;
import java.time.DayOfWeek;
import java.time.LocalTime;

public record EscalaSemanalResponse(Long id, DayOfWeek diaSemana, LocalTime horaInicio, LocalTime horaFim) {

    public static EscalaSemanalResponse de(EscalaSemanal escala) {
        return new EscalaSemanalResponse(escala.getId(), escala.getDiaSemana(), escala.getHoraInicio(), escala.getHoraFim());
    }
}
