package io.escritor.presenca.reuniao.web;

import io.escritor.presenca.reuniao.domain.Reuniao;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

public record ReuniaoResponse(
        Long id,
        Long criadorId,
        String criadorNome,
        List<ParticipanteResponse> participantes,
        LocalDate data,
        LocalTime horaInicio,
        LocalTime horaFim,
        String titulo,
        String linkMeet) {

    public static ReuniaoResponse de(Reuniao reuniao) {
        return new ReuniaoResponse(
                reuniao.getId(),
                reuniao.getCriador().getId(),
                reuniao.getCriador().getNome(),
                reuniao.getParticipantes().stream()
                        .map(participante -> new ParticipanteResponse(participante.getUsuario().getId(), participante.getUsuario().getNome()))
                        .toList(),
                reuniao.getData(),
                reuniao.getHoraInicio(),
                reuniao.getHoraFim(),
                reuniao.getTitulo(),
                reuniao.getLinkMeet());
    }

    public record ParticipanteResponse(Long id, String nome) {
    }
}
