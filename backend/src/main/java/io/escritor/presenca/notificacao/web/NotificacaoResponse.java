package io.escritor.presenca.notificacao.web;

import io.escritor.presenca.notificacao.domain.Notificacao;
import io.escritor.presenca.notificacao.domain.TipoNotificacao;
import java.time.Instant;

public record NotificacaoResponse(Long id, TipoNotificacao tipo, String texto, String link, boolean lida, Instant criadoEm) {

    public static NotificacaoResponse de(Notificacao notificacao) {
        return new NotificacaoResponse(
                notificacao.getId(), notificacao.getTipo(), notificacao.getTexto(), notificacao.getLink(), notificacao.isLida(),
                notificacao.getCriadoEm());
    }
}
