package io.escritor.presenca.apontamento.web;

import io.escritor.presenca.apontamento.domain.Apontamento;
import java.time.Instant;

public record ApontamentoResponse(
        Long id,
        Long usuarioId,
        Long cardId,
        Instant inicio,
        Instant fim,
        Integer minutos,
        String descricao,
        String origem,
        Instant criadoEm,
        Instant editadoEm) {

    public static ApontamentoResponse de(Apontamento apontamento) {
        return new ApontamentoResponse(
                apontamento.getId(),
                apontamento.getUsuario().getId(),
                apontamento.getCard().getId(),
                apontamento.getInicio(),
                apontamento.getFim(),
                apontamento.getMinutos(),
                apontamento.getDescricao(),
                apontamento.getOrigem().name(),
                apontamento.getCriadoEm(),
                apontamento.getEditadoEm());
    }
}
