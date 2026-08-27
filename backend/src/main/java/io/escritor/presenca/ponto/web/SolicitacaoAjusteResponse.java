package io.escritor.presenca.ponto.web;

import io.escritor.presenca.ponto.domain.SolicitacaoAjustePonto;
import io.escritor.presenca.ponto.domain.StatusSolicitacaoAjuste;
import io.escritor.presenca.ponto.domain.TipoRegistroPonto;
import java.time.Instant;

public record SolicitacaoAjusteResponse(
        Long id,
        TipoRegistroPonto tipoSolicitado,
        Instant momentoSolicitado,
        Long registroAlvoId,
        String justificativa,
        StatusSolicitacaoAjuste status) {

    public static SolicitacaoAjusteResponse de(SolicitacaoAjustePonto solicitacao) {
        Long registroAlvoId =
                solicitacao.getRegistroAlvo() == null ? null : solicitacao.getRegistroAlvo().getId();
        return new SolicitacaoAjusteResponse(
                solicitacao.getId(),
                solicitacao.getTipoSolicitado(),
                solicitacao.getMomentoSolicitado(),
                registroAlvoId,
                solicitacao.getJustificativa(),
                solicitacao.getStatus());
    }
}
