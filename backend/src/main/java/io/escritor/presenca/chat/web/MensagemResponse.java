package io.escritor.presenca.chat.web;

import io.escritor.presenca.chat.domain.Mensagem;
import java.time.Instant;

public record MensagemResponse(Long id, Long conversaId, Long autorId, String autorNome, String texto, Instant criadoEm) {

    public static MensagemResponse de(Mensagem mensagem) {
        return new MensagemResponse(
                mensagem.getId(),
                mensagem.getConversa().getId(),
                mensagem.getAutor().getId(),
                mensagem.getAutor().getNome(),
                mensagem.getTexto(),
                mensagem.getCriadoEm());
    }
}
