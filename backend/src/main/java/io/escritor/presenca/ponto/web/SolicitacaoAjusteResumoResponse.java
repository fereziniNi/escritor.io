package io.escritor.presenca.ponto.web;

import io.escritor.presenca.ponto.domain.SolicitacaoAjustePonto;
import io.escritor.presenca.ponto.domain.StatusSolicitacaoAjuste;
import io.escritor.presenca.ponto.domain.TipoRegistroPonto;
import java.time.Instant;

/**
 * Como {@link SolicitacaoAjusteResponse}, mas com o nome do solicitante - útil pra fila do
 * gestor, que precisa saber de quem é cada pedido sem uma chamada extra.
 */
public record SolicitacaoAjusteResumoResponse(
        Long id,
        Long usuarioId,
        String usuarioNome,
        TipoRegistroPonto tipoSolicitado,
        Instant momentoSolicitado,
        Long registroAlvoId,
        String justificativa,
        StatusSolicitacaoAjuste status,
        Instant criadoEm) {

    public static SolicitacaoAjusteResumoResponse de(SolicitacaoAjustePonto solicitacao) {
        Long registroAlvoId =
                solicitacao.getRegistroAlvo() == null ? null : solicitacao.getRegistroAlvo().getId();
        return new SolicitacaoAjusteResumoResponse(
                solicitacao.getId(),
                solicitacao.getUsuario().getId(),
                solicitacao.getUsuario().getNome(),
                solicitacao.getTipoSolicitado(),
                solicitacao.getMomentoSolicitado(),
                registroAlvoId,
                solicitacao.getJustificativa(),
                solicitacao.getStatus(),
                solicitacao.getCriadoEm());
    }
}
