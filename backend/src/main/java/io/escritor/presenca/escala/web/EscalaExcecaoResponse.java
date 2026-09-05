package io.escritor.presenca.escala.web;

import io.escritor.presenca.escala.domain.EscalaExcecao;
import java.time.LocalDate;
import java.time.LocalTime;

public record EscalaExcecaoResponse(
        Long id, LocalDate data, boolean trabalha, LocalTime horaInicio, LocalTime horaFim, String observacao) {

    public static EscalaExcecaoResponse de(EscalaExcecao excecao) {
        return new EscalaExcecaoResponse(
                excecao.getId(),
                excecao.getData(),
                excecao.isTrabalha(),
                excecao.getHoraInicio(),
                excecao.getHoraFim(),
                excecao.getObservacao());
    }
}
